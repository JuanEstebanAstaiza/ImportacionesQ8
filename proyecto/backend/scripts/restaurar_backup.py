"""Restaura un ZIP generado por `GET /admin/backup`.

Uso:
    python scripts/restaurar_backup.py copia.zip            # muestra qué haría
    python scripts/restaurar_backup.py copia.zip --aplicar  # restaura de verdad

Sobre una base de datos **vacía** (el caso real de recuperación ante desastre)
hay que crear antes el esquema:

    python scripts/restaurar_backup.py copia.zip --crear-esquema --aplicar

`alembic upgrade head` **no** sirve para arrancar una base vacía: la primera
revisión (`20260713_0001`) es un `Base.metadata.create_all()` de los modelos
actuales, así que crea ya todas las tablas y la siguiente revisión se estrella
con "Table 'organizaciones_solicitantes' already exists". El propio arranque de
la aplicación lo esquiva con el mismo `create_all` + `alembic stamp` que hace
aquí `--crear-esquema`. Alembic sigue siendo válido para llevar hacia adelante
una base que ya existe.

Se ejecuta contra la base de datos apuntada por `DATABASE_URL`, así que revisa
tu `.env` antes: **borra el contenido de las tablas** que vengan en el ZIP y las
reemplaza por el volcado. Por eso el modo por defecto es un simulacro.

Los archivos de `uploads/` y `generated_docs/` se restauran sin borrar lo que ya
exista: solo se sobrescriben los que estén en el ZIP.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from datetime import date, datetime, time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import Base, SessionLocal, engine  # noqa: E402
import models  # noqa: E402,F401 — registra todas las tablas en la metadata

FORMATO_SOPORTADO = 1


def _leer_manifiesto(zf: zipfile.ZipFile) -> dict:
    try:
        return json.loads(zf.read("manifest.json").decode("utf-8"))
    except KeyError:
        raise SystemExit("El ZIP no tiene manifest.json: no parece un backup de Zarpi.")


def _tablas_en_orden_de_carga():
    """Padres antes que hijos, para no violar las claves foráneas al insertar."""
    return list(Base.metadata.sorted_tables)


def _convertir(valor, columna):
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


def _tablas_existentes() -> set:
    from sqlalchemy import inspect

    try:
        return set(inspect(engine).get_table_names())
    except Exception as e:
        raise SystemExit(f"No se pudo inspeccionar la base de datos destino: {e}")


def _crear_esquema(aplicar: bool) -> None:
    """Crea el esquema en una base vacía y la marca en la revisión actual.

    Es lo mismo que hace `database.init_db()` cuando Alembic falla: `create_all`
    de los modelos + `alembic stamp head`. Se marca en `head` (no en la revisión
    del backup) porque las tablas creadas son las de los modelos de HOY; el
    volcado se adapta ignorando columnas que ya no existan.
    """
    if not aplicar:
        print("  - crear esquema (create_all + alembic stamp head)")
        return

    Base.metadata.create_all(bind=engine)

    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", str(engine.url.render_as_string(hide_password=False)))
    command.stamp(cfg, "head")
    print(f"  - esquema creado: {len(_tablas_existentes())} tabla(s), marcadas en head")


def _restaurar_datos(zf: zipfile.ZipFile, aplicar: bool) -> None:
    disponibles = {
        nombre.split("/", 1)[1].removesuffix(".ndjson")
        for nombre in zf.namelist()
        if nombre.startswith("datos/") and nombre.endswith(".ndjson")
    }

    tablas = [t for t in _tablas_en_orden_de_carga() if t.name in disponibles]
    if not tablas:
        print("El backup no contiene tablas conocidas.")
        return

    session = SessionLocal()
    try:
        # El borrado va en orden inverso (hijos primero) por las claves foráneas.
        for tabla in reversed(tablas):
            if aplicar:
                session.execute(tabla.delete())
            print(f"  - vaciar {tabla.name}")

        for tabla in tablas:
            crudo = zf.read(f"datos/{tabla.name}.ndjson").decode("utf-8")
            filas = [json.loads(linea) for linea in crudo.splitlines() if linea.strip()]
            print(f"  - cargar {tabla.name}: {len(filas)} fila(s)")
            if aplicar and filas:
                columnas = {c.name: c for c in tabla.columns}
                limpias = []
                for fila in filas:
                    # Ignorar columnas que ya no existen en el esquema actual:
                    # permite restaurar un backup anterior a una migración.
                    limpias.append({
                        clave: _convertir(valor, columnas[clave])
                        for clave, valor in fila.items()
                        if clave in columnas
                    })
                # Insertar por lotes evita paquetes gigantes en MySQL.
                for inicio in range(0, len(limpias), 500):
                    session.execute(tabla.insert(), limpias[inicio:inicio + 500])

        if aplicar:
            session.commit()
        else:
            session.rollback()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _restaurar_archivos(zf: zipfile.ZipFile, aplicar: bool) -> int:
    total = 0
    for nombre in zf.namelist():
        if not nombre.startswith("archivos/") or nombre.endswith("/"):
            continue
        relativo = nombre.split("/", 1)[1]
        destino = BACKEND_DIR / relativo
        total += 1
        if aplicar:
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(zf.read(nombre))
    return total


def verificar_conteos(manifiesto: dict) -> list:
    """Filas por tabla en la base frente a las del manifiesto, tras restaurar.

    Devuelve la lista de discrepancias como (tabla, esperadas, encontradas).
    Solo compara tablas que existen en el esquema actual: las que el backup trae
    y el código ya no conoce no se restauran, y eso se avisa aparte.
    """
    from sqlalchemy import func, select

    conocidas = {t.name: t for t in Base.metadata.sorted_tables}
    discrepancias = []
    session = SessionLocal()
    try:
        for tabla, esperadas in (manifiesto.get("tablas") or {}).items():
            if tabla not in conocidas:
                continue
            encontradas = session.execute(select(func.count()).select_from(conocidas[tabla])).scalar()
            if encontradas != esperadas:
                discrepancias.append((tabla, esperadas, encontradas))
    finally:
        session.close()
    return discrepancias


def main() -> None:
    parser = argparse.ArgumentParser(description="Restaura una copia de seguridad de Zarpi.")
    parser.add_argument("zip", type=Path, help="Ruta del archivo .zip generado por GET /admin/backup")
    parser.add_argument(
        "--aplicar",
        action="store_true",
        help="Ejecuta la restauración. Sin esta bandera solo se muestra qué haría.",
    )
    parser.add_argument("--sin-archivos", action="store_true", help="No restaurar uploads/ ni generated_docs/")
    parser.add_argument(
        "--crear-esquema",
        action="store_true",
        help="Crear las tablas antes de restaurar (base de datos vacía). No toca una base que ya tenga tablas.",
    )
    args = parser.parse_args()

    if not args.zip.is_file():
        raise SystemExit(f"No existe el archivo {args.zip}")

    # Antes de borrar nada: el ZIP tiene que estar entero (suma SHA-256 si
    # existe, CRC de cada entrada y conteos del manifiesto).
    from scripts.backup import verificar_backup

    try:
        verificar_backup(args.zip)
    except ValueError as e:
        raise SystemExit(f"El backup no es fiable, no se restaura nada: {e}")

    with zipfile.ZipFile(args.zip) as zf:
        manifiesto = _leer_manifiesto(zf)

        if manifiesto.get("formato") != FORMATO_SOPORTADO:
            raise SystemExit(
                f"Formato de backup {manifiesto.get('formato')} no soportado por este script "
                f"(esperaba {FORMATO_SOPORTADO})."
            )

        print(f"Backup generado el {manifiesto.get('generado_en')}")
        print(f"Revisión de esquema del backup: {manifiesto.get('revision_alembic')}")
        print(f"Base de datos destino: {os.getenv('DATABASE_URL', '(DATABASE_URL sin definir)')}")
        print(f"Motor conectado: {engine.url.render_as_string(hide_password=True)}")

        if not args.aplicar:
            print("\n--- SIMULACRO (usa --aplicar para restaurar de verdad) ---")

        existentes = _tablas_existentes()
        if args.crear_esquema and existentes:
            print(f"\nEsquema: la base ya tiene {len(existentes)} tabla(s); se omite --crear-esquema.")
        elif args.crear_esquema:
            print("\nEsquema:")
            _crear_esquema(args.aplicar)
        elif not existentes:
            raise SystemExit(
                "La base de datos destino está vacía. Vuelve a ejecutar con --crear-esquema "
                "para crear las tablas antes de restaurar (`alembic upgrade head` no arranca "
                "una base vacía: ver la documentación de este script)."
            )

        print("\nDatos:")
        _restaurar_datos(zf, args.aplicar)

        if not args.sin_archivos:
            copiados = _restaurar_archivos(zf, args.aplicar)
            print(f"\nArchivos: {copiados} archivo(s) de uploads/ y generated_docs/")

    if args.aplicar:
        desconocidas = sorted(set(manifiesto.get("tablas") or {}) - {t.name for t in Base.metadata.sorted_tables})
        if desconocidas:
            print(f"\nAviso: el backup trae tablas que este código ya no tiene y no se restauraron: {', '.join(desconocidas)}")
        discrepancias = verificar_conteos(manifiesto)
        if discrepancias:
            print("\nERROR: la base restaurada no coincide con el backup:", file=sys.stderr)
            for tabla, esperadas, encontradas in discrepancias:
                print(f"  - {tabla}: esperadas {esperadas}, encontradas {encontradas}", file=sys.stderr)
            raise SystemExit(1)
        print("\nVerificación: todas las tablas tienen las mismas filas que el backup.")
        print("\nRestauración completada.")
        if manifiesto.get("revision_alembic") and not args.crear_esquema:
            print(
                "Si la revisión de esquema del backup es anterior a la de esta base, "
                "ejecuta: alembic upgrade head"
            )
    else:
        print("\nNada se modificó.")


if __name__ == "__main__":
    main()
