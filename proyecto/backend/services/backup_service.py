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

import json
import logging
import zipfile
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterator, List, Optional
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
