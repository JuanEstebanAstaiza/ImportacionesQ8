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
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import Base, SessionLocal, engine  # noqa: E402
import models  # noqa: E402,F401 — registra todas las tablas en la metadata
from services.backup_service import (  # noqa: E402
    convertir_valor as _convertir,  # noqa: F401 — lo usan los tests
    restaurar_desde_zip,
    verificar_backup,
    verificar_conteos as _verificar_conteos,
)


def verificar_conteos(manifiesto: dict) -> list:
    """Discrepancias (tabla, esperadas, encontradas) entre la base y el manifiesto."""
    session = SessionLocal()
    try:
        return _verificar_conteos(session, manifiesto)
    finally:
        session.close()


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
    # existe, CRC de cada entrada, formato y conteos del manifiesto).
    try:
        manifiesto = verificar_backup(args.zip)
    except ValueError as e:
        raise SystemExit(f"El backup no es fiable, no se restaura nada: {e}")

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

    print()
    session = SessionLocal()
    try:
        resultado = restaurar_desde_zip(
            session, args.zip, aplicar=args.aplicar, incluir_archivos=not args.sin_archivos, informar=print,
        )
    except RuntimeError as e:
        print(f"\nERROR: {e}", file=sys.stderr)
        raise SystemExit(1)
    finally:
        session.close()

    if not args.sin_archivos:
        print(f"\nArchivos: {resultado['archivos_restaurados']} archivo(s) de uploads/ y generated_docs/")

    if args.aplicar:
        if resultado["tablas_desconocidas"]:
            print("\nAviso: el backup trae tablas que este código ya no tiene y no se restauraron: "
                  + ", ".join(resultado["tablas_desconocidas"]))
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
