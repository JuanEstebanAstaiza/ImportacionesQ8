"""Documentación de ayuda en base de datos.

Vivía en un archivo del frontend (`help-support-content.ts`), así que añadir una
respuesta a una duda nueva exigía tocar código y desplegar. En la práctica eso
significaba que la documentación no crecía, aunque el equipo de soporte viera la
misma pregunta cada semana.

Aquí la escribe y la corrige quien atiende los tickets, desde el panel.

Revision ID: 20260810_0017
Revises: 20260809_0016
Create Date: 2026-08-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260810_0017"
down_revision: Union[str, None] = "20260809_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "articulos_ayuda"


def upgrade() -> None:
    # La revisión inicial hace `create_all` de los modelos actuales, así que en
    # una base recién creada la tabla ya existe.
    if TABLA in sa.inspect(op.get_bind()).get_table_names():
        return

    op.create_table(
        TABLA,
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("resumen", sa.String(length=400), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=True),
        sa.Column("categoria", sa.String(length=60), nullable=False),
        sa.Column("roles", sa.JSON(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("publicado", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("vistas", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("votos_util", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("votos_inutil", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("autor_id", sa.String(length=36), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["autor_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_articulos_ayuda_categoria"), TABLA, ["categoria"])


def downgrade() -> None:
    if TABLA not in sa.inspect(op.get_bind()).get_table_names():
        return
    op.drop_index(op.f("ix_articulos_ayuda_categoria"), table_name=TABLA)
    op.drop_table(TABLA)
