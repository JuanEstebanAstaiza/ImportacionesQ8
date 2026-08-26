"""Certificaciones otorgadas por la plataforma a las empresas importadoras.

Revision ID: 20260806_0009
Revises: 20260806_0008
Create Date: 2026-08-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260806_0009"
down_revision: Union[str, None] = "20260806_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certificaciones",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("nombre", sa.String(length=120), nullable=False, unique=True),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("peso_publicidad", sa.Float(), nullable=False, server_default="0"),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("creada_por_admin_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "certificaciones_importador",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("certificacion_id", sa.String(length=36), sa.ForeignKey("certificaciones.id"), nullable=False),
        sa.Column("importador_id", sa.String(length=36), sa.ForeignKey("importadores.id"), nullable=False),
        sa.Column("otorgada_por_admin_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("fecha_otorgada", sa.DateTime(), nullable=True),
        sa.Column("revocada_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("certificacion_id", "importador_id", name="unique_certificacion_importador"),
    )
    op.create_index("ix_certificaciones_importador_certificacion_id", "certificaciones_importador", ["certificacion_id"])
    op.create_index("ix_certificaciones_importador_importador_id", "certificaciones_importador", ["importador_id"])
    op.create_index("ix_certificacion_importador_vigente", "certificaciones_importador", ["importador_id", "revocada_at"])


def downgrade() -> None:
    op.drop_index("ix_certificacion_importador_vigente", table_name="certificaciones_importador")
    op.drop_index("ix_certificaciones_importador_importador_id", table_name="certificaciones_importador")
    op.drop_index("ix_certificaciones_importador_certificacion_id", table_name="certificaciones_importador")
    op.drop_table("certificaciones_importador")
    op.drop_table("certificaciones")
