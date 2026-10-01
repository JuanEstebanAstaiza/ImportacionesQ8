"""Copia de seguridad completa de la plataforma en un solo archivo ZIP.

Pensado para el caso "voy a actualizar, quiero poder volver atrás" sin depender
de integración continua ni de herramientas externas: un admin descarga el ZIP
antes de desplegar y, si algo sale mal, lo restaura con
`scripts/restaurar_backup.py`.

El volcado de datos es **portable**: se serializa tabla por tabla en NDJSON
leyendo la metadata de SQLAlchemy, no con `mysqldump`. Así el mismo archivo sirve
tanto si la instancia corre sobre MySQL como sobre SQLite, y no hace falta que el
contenedor traiga binarios del motor de base de datos.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import zipfile
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable, Iterator, List, Optional
from uuid import UUID

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from database import Base, engine

logger = logging.getLogger("importacionesq8")

# Directorios con binarios subidos por los usuarios. Sin ellos el volcado de la
# base de datos apuntaría a archivos inexistentes tras restaurar.
BACKEND_DIR = Path(__file__).resolve().parent.parent
DIRECTORIOS_DE_ARCHIVOS = ("uploads", "generated_docs")

# Formato del volcado. Subir este número solo si cambia la estructura del ZIP.
FORMATO_BACKUP = 1

# Carpeta (montada desde el host en Docker) donde viven las copias del servidor,
# las subidas pendientes de restaurar y la copia automática previa a restaurar.
BACKUPS_DIR = Path(os.getenv("BACKUP_DIR", str(BACKEND_DIR / "backups")))


def _serializar(valor: Any) -> Any:
    """Convierte los tipos de columna a algo que `json.dumps` entienda."""
    if valor is None or isinstance(valor, (str, int, float, bool)):
        return valor
    if isinstance(valor, (datetime, date, time)):
        return valor.isoformat()
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, UUID):
        return str(valor)
    if isinstance(valor, (bytes, bytearray)):
        return {"__bytes_hex__": valor.hex()}
    if isinstance(valor, (dict, list)):
        return valor
    return str(valor)


def _revision_alembic(db: Session) -> Optional[str]:
    """Revisión de esquema actual, para detectar restauraciones incompatibles."""
    try:
        fila = db.execute("SELECT version_num FROM alembic_version").first()  # type: ignore[arg-type]
        return str(fila[0]) if fila else None
    except Exception:
        try:
            from sqlalchemy import text

            fila = db.execute(text("SELECT version_num FROM alembic_version")).first()
            return str(fila[0]) if fila else None
        except Exception:
            return None


def _tablas_existentes() -> List[str]:
    try:
        return sa_inspect(engine).get_table_names()
    except Exception:
        logger.warning("No se pudieron inspeccionar las tablas para el backup", exc_info=True)
        return []


def _filas_de_tabla(db: Session, tabla) -> Iterator[dict]:
    for fila in db.execute(tabla.select()):
        yield {col: _serializar(val) for col, val in zip(fila._mapping.keys(), fila._mapping.values())}


def construir_backup(db: Session, destino: Path, *, incluir_archivos: bool = True) -> dict:
    """Escribe el ZIP en `destino` y devuelve su manifiesto.

    Estructura del ZIP:
      manifest.json          — versión, fecha, revisión de alembic y conteos
      datos/<tabla>.ndjson   — una fila JSON por línea
      archivos/<dir>/...     — uploads/ y generated_docs/ tal cual
    """
    destino.parent.mkdir(parents=True, exist_ok=True)

    presentes = set(_tablas_existentes())
    conteos: dict = {}
    archivos_copiados = 0

    manifiesto = {
        "formato": FORMATO_BACKUP,
        "generado_en": datetime.utcnow().isoformat() + "Z",
        "revision_alembic": _revision_alembic(db),
        "tablas": conteos,
        "incluye_archivos": incluir_archivos,
    }

    # ZIP_DEFLATED: los NDJSON comprimen muchísimo y los uploads suelen ser el
    # grueso del tamaño final.
    with zipfile.ZipFile(destino, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
        for tabla in Base.metadata.sorted_tables:
            if tabla.name not in presentes:
                continue

            total = 0
            lineas: List[str] = []
            try:
                for registro in _filas_de_tabla(db, tabla):
                    lineas.append(json.dumps(registro, ensure_ascii=False))
                    total += 1
            except Exception:
                logger.warning("No se pudo volcar la tabla %s", tabla.name, exc_info=True)
                continue

            zf.writestr(f"datos/{tabla.name}.ndjson", "\n".join(lineas))
            conteos[tabla.name] = total

        if incluir_archivos:
            for nombre_dir in DIRECTORIOS_DE_ARCHIVOS:
                carpeta = BACKEND_DIR / nombre_dir
                if not carpeta.is_dir():
                    continue
                for archivo in carpeta.rglob("*"):
                    if not archivo.is_file():
                        continue
                    zf.write(archivo, f"archivos/{nombre_dir}/{archivo.relative_to(carpeta).as_posix()}")
                    archivos_copiados += 1

        manifiesto["archivos_copiados"] = archivos_copiados
        zf.writestr("manifest.json", json.dumps(manifiesto, ensure_ascii=False, indent=2))

    return manifiesto


def nombre_de_archivo(momento: Optional[datetime] = None) -> str:
    marca = (momento or datetime.utcnow()).strftime("%Y%m%d-%H%M%S")
    return f"importacionesq8-backup-{marca}.zip"


# ==================== Verificación ====================

def sha256_de(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        for bloque in iter(lambda: f.read(1024 * 1024), b""):
            h.update(bloque)
    return h.hexdigest()


def verificar_backup(ruta: Path) -> dict:
    """Comprueba que el ZIP esté entero y sea coherente con su manifiesto.

    Suma SHA-256 (si hay `<zip>.sha256` al lado), CRC de cada entrada, formato y
    conteo de filas de cada tabla contra el manifiesto. Devuelve el manifiesto;
    lanza `ValueError` con el motivo si algo no cuadra.
    """
    suma = ruta.with_name(ruta.name + ".sha256")
    if suma.is_file():
        esperada = suma.read_text(encoding="utf-8").split()[0]
        if esperada != sha256_de(ruta):
            raise ValueError(f"La suma SHA-256 de {ruta.name} no coincide: el archivo está dañado o fue modificado.")

    try:
        with zipfile.ZipFile(ruta) as zf:
            dañado = zf.testzip()
            if dañado:
                raise ValueError(f"Entrada corrupta dentro del ZIP: {dañado}")
            try:
                manifiesto = json.loads(zf.read("manifest.json").decode("utf-8"))
            except KeyError:
                raise ValueError("El ZIP no tiene manifest.json: no parece una copia de seguridad de la plataforma.")
            except ValueError:
                raise ValueError("El manifest.json del ZIP no es JSON válido.")
            if manifiesto.get("formato") != FORMATO_BACKUP:
                raise ValueError(
                    f"Formato de copia {manifiesto.get('formato')} no soportado (se esperaba {FORMATO_BACKUP})."
                )
            nombres = set(zf.namelist())
            for tabla, filas in (manifiesto.get("tablas") or {}).items():
                entrada = f"datos/{tabla}.ndjson"
                if entrada not in nombres:
                    raise ValueError(f"Falta {entrada} aunque el manifiesto la declara")
                crudo = zf.read(entrada).decode("utf-8")
                contadas = sum(1 for linea in crudo.splitlines() if linea.strip())
                if contadas != filas:
                    raise ValueError(f"{tabla}: el manifiesto dice {filas} filas y el ZIP trae {contadas}")
            archivos = sum(1 for n in nombres if n.startswith("archivos/") and not n.endswith("/"))
            if archivos != manifiesto.get("archivos_copiados", archivos):
                raise ValueError(
                    f"El manifiesto declara {manifiesto.get('archivos_copiados')} archivos y el ZIP trae {archivos}"
                )
            for nombre in nombres:
                if nombre.startswith("archivos/") and not nombre.endswith("/") and _destino_de_archivo(nombre) is None:
                    raise ValueError(f"Ruta no permitida dentro del ZIP: {nombre}")
    except zipfile.BadZipFile as e:
        raise ValueError(f"{ruta.name} no es un ZIP válido: {e}")
    return manifiesto


# ==================== Restauración ====================

def convertir_valor(valor, columna):
    """Devuelve el valor con el tipo Python que espera la columna.

    En el ZIP todo viaja como JSON, así que las fechas llegan como texto ISO y
    los binarios como hex. SQLAlchemy rechaza un `str` en una columna DateTime,
    de modo que hay que rehidratarlos antes de insertar.
    """
    if valor is None:
        return None

    if isinstance(valor, dict) and "__bytes_hex__" in valor:
        return bytes.fromhex(valor["__bytes_hex__"])

    tipo = getattr(columna, "type", None)
    nombre_tipo = type(tipo).__name__.upper() if tipo is not None else ""

    if isinstance(valor, str) and nombre_tipo in ("DATETIME", "TIMESTAMP", "DATE", "TIME"):
        texto = valor.rstrip("Z")
        try:
            if nombre_tipo == "DATE":
                return date.fromisoformat(texto)
            if nombre_tipo == "TIME":
                return time.fromisoformat(texto)
            return datetime.fromisoformat(texto)
        except ValueError:
            # Formato inesperado: se deja tal cual y que falle de forma visible
            # en vez de insertar una fecha inventada.
            return valor

    return valor


def _destino_de_archivo(nombre_en_zip: str) -> Optional[Path]:
    """Ruta donde restaurar `archivos/<dir>/<ruta>`, o None si sale de su carpeta.

    El ZIP puede llegar subido desde el panel: sin esta comprobación, una entrada
    como `archivos/uploads/../../main.py` escribiría fuera de los directorios de
    archivos (zip slip).
    """
    partes = nombre_en_zip.split("/", 2)
    if len(partes) != 3 or partes[0] != "archivos" or partes[1] not in DIRECTORIOS_DE_ARCHIVOS or not partes[2]:
        return None
    base = (BACKEND_DIR / partes[1]).resolve()
    destino = (base / partes[2]).resolve()
    if destino == base or base not in destino.parents:
        return None
    return destino


def _restaurar_datos(db: Session, zf: zipfile.ZipFile, aplicar: bool, informar: Callable[[str], None]) -> dict:
    """Vacía y recarga las tablas del ZIP en UNA transacción. Devuelve filas por tabla."""
    disponibles = {
        nombre.split("/", 1)[1].removesuffix(".ndjson")
        for nombre in zf.namelist()
        if nombre.startswith("datos/") and nombre.endswith(".ndjson")
    }
    tablas = [t for t in Base.metadata.sorted_tables if t.name in disponibles]
    cargadas: dict = {}
    if not tablas:
        informar("El backup no contiene tablas conocidas.")
        return cargadas

    try:
        # El borrado va en orden inverso (hijos primero) por las claves foráneas.
        for tabla in reversed(tablas):
            if aplicar:
                db.execute(tabla.delete())
            informar(f"  - vaciar {tabla.name}")

        for tabla in tablas:
            crudo = zf.read(f"datos/{tabla.name}.ndjson").decode("utf-8")
            filas = [json.loads(linea) for linea in crudo.splitlines() if linea.strip()]
            informar(f"  - cargar {tabla.name}: {len(filas)} fila(s)")
            cargadas[tabla.name] = len(filas)
            if aplicar and filas:
                columnas = {c.name: c for c in tabla.columns}
                # Ignorar columnas que ya no existen en el esquema actual:
                # permite restaurar un backup anterior a una migración.
                limpias = [
                    {clave: convertir_valor(valor, columnas[clave]) for clave, valor in fila.items() if clave in columnas}
                    for fila in filas
                ]
                # Insertar por lotes evita paquetes gigantes en MySQL.
                for inicio in range(0, len(limpias), 500):
                    db.execute(tabla.insert(), limpias[inicio:inicio + 500])

        if aplicar:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise
    return cargadas


def _restaurar_archivos(zf: zipfile.ZipFile, aplicar: bool) -> int:
    """Escribe uploads/ y generated_docs/ sin borrar lo que ya exista."""
    total = 0
    for nombre in zf.namelist():
        if not nombre.startswith("archivos/") or nombre.endswith("/"):
            continue
        destino = _destino_de_archivo(nombre)
        if destino is None:
            raise ValueError(f"Ruta no permitida dentro del ZIP: {nombre}")
        total += 1
        if aplicar:
            destino.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(nombre) as origen, destino.open("wb") as salida:
                for bloque in iter(lambda: origen.read(1024 * 1024), b""):
                    salida.write(bloque)
    return total


def verificar_conteos(db: Session, manifiesto: dict) -> list:
    """Filas por tabla en la base frente a las del manifiesto, tras restaurar.

    Devuelve las discrepancias como (tabla, esperadas, encontradas). Solo compara
    tablas que existen en el esquema actual.
    """
    from sqlalchemy import func, select

    conocidas = {t.name: t for t in Base.metadata.sorted_tables}
    discrepancias = []
    for tabla, esperadas in (manifiesto.get("tablas") or {}).items():
        if tabla not in conocidas:
            continue
        encontradas = db.execute(select(func.count()).select_from(conocidas[tabla])).scalar()
        if encontradas != esperadas:
            discrepancias.append((tabla, esperadas, encontradas))
    return discrepancias


def tablas_desconocidas(manifiesto: dict) -> List[str]:
    """Tablas del backup que el código actual ya no tiene (no se restauran)."""
    return sorted(set(manifiesto.get("tablas") or {}) - {t.name for t in Base.metadata.sorted_tables})


def restaurar_desde_zip(
    db: Session,
    ruta: Path,
    *,
    aplicar: bool = True,
    incluir_archivos: bool = True,
    informar: Optional[Callable[[str], None]] = None,
) -> dict:
    """Restaura base de datos (y archivos) desde un ZIP ya verificado.

    Reemplaza el contenido de cada tabla incluida en el ZIP. Al terminar compara
    los conteos con el manifiesto y lanza `RuntimeError` si no coinciden.
    """
    informar = informar or (lambda _mensaje: None)
    manifiesto = verificar_backup(ruta)
    with zipfile.ZipFile(ruta) as zf:
        informar("Datos:")
        cargadas = _restaurar_datos(db, zf, aplicar, informar)
        archivos = _restaurar_archivos(zf, aplicar) if incluir_archivos else 0

    discrepancias = verificar_conteos(db, manifiesto) if aplicar else []
    if discrepancias:
        detalle = ", ".join(f"{t}: esperadas {e}, encontradas {n}" for t, e, n in discrepancias)
        raise RuntimeError(f"La base restaurada no coincide con el backup ({detalle})")

    return {
        "manifiesto": manifiesto,
        "tablas_restauradas": len(cargadas),
        "filas_restauradas": sum(cargadas.values()),
        "archivos_restaurados": archivos,
        "tablas_desconocidas": tablas_desconocidas(manifiesto),
    }
