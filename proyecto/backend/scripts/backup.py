#!/usr/bin/env python3
"""Genera una copia de seguridad portable desde la línea de comandos.

Es el mismo ZIP que descarga un admin con `GET /admin/backup` (tablas en NDJSON
+ uploads/ + generated_docs/), pero pensado para ejecutarse solo: lo lanza el
cron del servidor (`scripts/backup_servidor.sh`) o la integración continua
antes de desplegar. Al no depender de mysqldump ni de Docker, el mismo ZIP se
restaura en un contenedor, en una instalación nativa o sobre otro motor.

    python scripts/backup.py                     # en BACKUP_DIR (por defecto ./backups)
    python scripts/backup.py --destino /ruta     # en otra carpeta
    python scripts/backup.py --retener 14        # conserva solo los 14 más recientes
    python scripts/backup.py --verificar copia.zip   # comprueba un ZIP ya hecho

Además del ZIP escribe `<zip>.sha256`, que `restaurar_backup.py` comprueba antes
de tocar nada. Termina con código 0 solo si el ZIP se generó y pasó la
verificación, para que el cron o la CI puedan abortar el despliegue si falla.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import List, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

PATRON_BACKUP = "importacionesq8-backup-*.zip"

from services.backup_service import sha256_de, verificar_backup  # noqa: E402,F401 — reexportadas


def escribir_suma(ruta: Path) -> Path:
    """Formato de `sha256sum`, para poder comprobarlo también con `sha256sum -c`."""
    suma = ruta.with_name(ruta.name + ".sha256")
    suma.write_text(f"{sha256_de(ruta)}  {ruta.name}\n", encoding="utf-8")
    return suma


def aplicar_retencion(carpeta: Path, conservar: int) -> List[Path]:
    """Borra los backups más antiguos y deja los `conservar` más recientes.

    El nombre lleva la fecha (`importacionesq8-backup-AAAAMMDD-HHMMSS.zip`), así
    que el orden alfabético es el cronológico; no se usa la fecha del sistema de
    ficheros porque una copia o un `rsync` la cambian.
    """
    if conservar < 1:
        return []
    copias = sorted(carpeta.glob(PATRON_BACKUP))
    sobrantes = copias[:-conservar] if len(copias) > conservar else []
    for zip_viejo in sobrantes:
        zip_viejo.unlink(missing_ok=True)
        zip_viejo.with_name(zip_viejo.name + ".sha256").unlink(missing_ok=True)
    return sobrantes


def generar(destino_dir: Path, *, incluir_archivos: bool = True) -> tuple[Path, dict]:
    from database import SessionLocal
    import models  # noqa: F401 — registra todas las tablas en la metadata
    from services.backup_service import construir_backup, nombre_de_archivo

    destino_dir.mkdir(parents=True, exist_ok=True)
    final = destino_dir / nombre_de_archivo()
    # Se escribe con otro nombre y se renombra al terminar: así ni la retención
    # ni una copia externa en curso ven nunca un ZIP a medias.
    parcial = final.with_name(final.name + ".parcial")
    db = SessionLocal()
    try:
        manifiesto = construir_backup(db, parcial, incluir_archivos=incluir_archivos)
    finally:
        db.close()

    # `construir_backup` salta (con un aviso en el log) la tabla que no logra
    # leer, para que la descarga desde el panel no falle entera. Aquí eso no
    # vale: un backup al que le falta una tabla es peor que ninguno, porque
    # da una falsa seguridad hasta el día que se necesita.
    from database import Base
    from services.backup_service import _tablas_existentes

    esperadas = {t.name for t in Base.metadata.sorted_tables} & set(_tablas_existentes())
    omitidas = sorted(esperadas - set(manifiesto["tablas"]))
    if omitidas:
        parcial.unlink(missing_ok=True)
        raise RuntimeError(f"No se pudieron volcar estas tablas: {', '.join(omitidas)}")

    parcial.replace(final)
    escribir_suma(final)
    return final, manifiesto


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Copia de seguridad portable de Zarpi.")
    parser.add_argument(
        "--destino",
        type=Path,
        default=Path(os.getenv("BACKUP_DIR", str(BACKEND_DIR / "backups"))),
        help="Carpeta donde dejar el ZIP (por defecto BACKUP_DIR o ./backups)",
    )
    parser.add_argument(
        "--retener",
        type=int,
        default=int(os.getenv("BACKUP_RETENCION", "14")),
        help="Cuántos backups conservar en la carpeta (0 = no borrar ninguno)",
    )
    parser.add_argument("--sin-archivos", action="store_true", help="Solo la base de datos, sin uploads/")
    parser.add_argument("--verificar", type=Path, metavar="ZIP", help="Solo verificar un ZIP existente")
    args = parser.parse_args(argv)

    if args.verificar:
        try:
            manifiesto = verificar_backup(args.verificar)
        except ValueError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 1
        print(f"OK: {args.verificar.name} íntegro — {sum(manifiesto['tablas'].values())} filas en "
              f"{len(manifiesto['tablas'])} tablas, {manifiesto.get('archivos_copiados', 0)} archivos.")
        return 0

    try:
        ruta, manifiesto = generar(args.destino, incluir_archivos=not args.sin_archivos)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    try:
        verificar_backup(ruta)
    except ValueError as e:
        print(f"ERROR: el backup recién generado no pasó la verificación: {e}", file=sys.stderr)
        return 1

    borrados = aplicar_retencion(args.destino, args.retener)
    tamaño_mb = ruta.stat().st_size / (1024 * 1024)
    print(f"Backup: {ruta}")
    print(f"  {sum(manifiesto['tablas'].values())} filas en {len(manifiesto['tablas'])} tablas, "
          f"{manifiesto.get('archivos_copiados', 0)} archivos, {tamaño_mb:.1f} MB")
    print(f"  esquema (alembic): {manifiesto.get('revision_alembic')}")
    if borrados:
        print(f"  retención: {len(borrados)} backup(s) antiguo(s) borrado(s), quedan {args.retener}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
