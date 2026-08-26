"""Certificados de finalización de curso.

Revision ID: 20260806_0008
Revises: 20260805_0007
Create Date: 2026-08-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260806_0008"
down_revision: Union[str, None] = "20260805_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certificados_curso",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("curso_id", sa.String(length=36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("archivo_id", sa.String(length=36), sa.ForeignKey("archivos.id"), nullable=False),
        sa.Column("fecha_emision", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("curso_id", "usuario_id", name="unique_certificado_curso_usuario"),
    )
    op.create_index("ix_certificados_curso_curso_id", "certificados_curso", ["curso_id"])
    op.create_index("ix_certificados_curso_usuario_id", "certificados_curso", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_certificados_curso_usuario_id", table_name="certificados_curso")
    op.drop_index("ix_certificados_curso_curso_id", table_name="certificados_curso")
    op.drop_table("certificados_curso")
