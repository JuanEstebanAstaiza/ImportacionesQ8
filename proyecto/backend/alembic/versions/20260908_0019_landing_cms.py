"""CMS por bloques de la Landing Page.

El contenido dinámico de la Landing (bloques, aliados, novedades) vivía
hardcodeado en el frontend; ahora lo administra el equipo desde el panel sin
desplegar código.

Revision ID: 20260908_0019
Revises: 20260831_0018
Create Date: 2026-09-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260908_0019"
down_revision: Union[str, None] = "20260831_0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tablas_existentes = sa.inspect(op.get_bind()).get_table_names()

    if "landing_blocks" not in tablas_existentes:
        op.create_table(
            "landing_blocks",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("seccion", sa.String(length=30), nullable=False, server_default="home"),
            sa.Column("tipo", sa.String(length=20), nullable=False),
            sa.Column("contenido", sa.Text(), nullable=True),
            sa.Column("alineacion", sa.String(length=10), nullable=False, server_default="left"),
            sa.Column("tamano_fuente", sa.String(length=10), nullable=False, server_default="md"),
            sa.Column("accion_boton", sa.String(length=20), nullable=True),
            sa.Column("accion_url", sa.String(length=500), nullable=True),
            sa.Column("token_color", sa.String(length=20), nullable=False, server_default="foreground"),
            sa.Column("orden", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_landing_blocks_seccion"), "landing_blocks", ["seccion"])

    if "landing_allies" not in tablas_existentes:
        op.create_table(
            "landing_allies",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("nombre", sa.String(length=150), nullable=False),
            sa.Column("logo_url", sa.String(length=500), nullable=True),
            sa.Column("categoria", sa.String(length=80), nullable=True),
            sa.Column("enlace", sa.String(length=500), nullable=True),
            sa.Column("orden", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if "landing_news" not in tablas_existentes:
        op.create_table(
            "landing_news",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("titulo", sa.String(length=200), nullable=False),
            sa.Column("resumen", sa.String(length=400), nullable=False),
            sa.Column("contenido", sa.Text(), nullable=True),
            sa.Column("imagen_url", sa.String(length=500), nullable=True),
            sa.Column("fecha_publicacion", sa.DateTime(), nullable=True),
            sa.Column("orden", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    tablas_existentes = sa.inspect(op.get_bind()).get_table_names()
    if "landing_news" in tablas_existentes:
        op.drop_table("landing_news")
    if "landing_allies" in tablas_existentes:
        op.drop_table("landing_allies")
    if "landing_blocks" in tablas_existentes:
        op.drop_index(op.f("ix_landing_blocks_seccion"), table_name="landing_blocks")
        op.drop_table("landing_blocks")
