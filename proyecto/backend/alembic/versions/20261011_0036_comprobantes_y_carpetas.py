"""Comprobantes de pago manuales y carpetas por módulo en gestión documental.

1. Tabla `comprobantes_pago` («Cargue y descargue de pagos»).
2. Los archivos que subieron Tendencias, Catálogos, Perfil y Presentación de
   empresa quedaban en la raíz de gestión documental de cada usuario: se mueven
   a su carpeta (la misma que usa ahora la subida, ver
   `documental_service.CARPETA_POR_ORIGEN`).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

revision: str = "20261011_0036"
down_revision: Union[str, None] = "20261010_0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if "comprobantes_pago" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "comprobantes_pago",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False),
            sa.Column("tipo", sa.String(length=20), nullable=False),
            sa.Column("estado", sa.String(length=20), nullable=False),
            sa.Column("archivo_id", sa.String(length=36), sa.ForeignKey("archivos.id"), nullable=False),
            sa.Column("subido_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False),
            sa.Column("cantidad_solicitada", sa.Integer(), nullable=True),
            sa.Column("monto_cop", sa.Integer(), nullable=True),
            sa.Column("nota", sa.String(length=500), nullable=True),
            sa.Column("cantidad_acreditada", sa.Integer(), nullable=True),
            sa.Column("motivo_rechazo", sa.String(length=300), nullable=True),
            sa.Column("revisado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("revisado_en", sa.DateTime(), nullable=True),
            sa.Column("participacion_id", sa.String(length=36), sa.ForeignKey("reto_participaciones.id"), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
        )
        for columna in ("usuario_id", "tipo", "estado", "archivo_id", "fecha_creacion"):
            op.create_index(f"ix_comprobantes_pago_{columna}", "comprobantes_pago", [columna])

    # Archivos sueltos en la raíz → su carpeta.
    from models.documental import Archivo
    from services.documental_service import CARPETA_POR_ORIGEN, ensure_folder_path

    db = Session(bind=bind)
    try:
        sueltos = (
            db.query(Archivo)
            .filter(Archivo.carpeta_id.is_(None), Archivo.deleted_at.is_(None),
                    Archivo.origen.in_(list(CARPETA_POR_ORIGEN)))
            .all()
        )
        for archivo in sueltos:
            archivo.carpeta_id = ensure_folder_path(
                db, owner_user_id=archivo.owner_user_id, segments=CARPETA_POR_ORIGEN[archivo.origen])
        db.commit()
    finally:
        db.close()


def downgrade() -> None:
    if "comprobantes_pago" in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table("comprobantes_pago")
