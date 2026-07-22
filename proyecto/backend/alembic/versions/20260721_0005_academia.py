"""Módulo académico: cursos, lecciones, compras y progreso.

Revision ID: 20260721_0005
Revises: 20260714_0004
Create Date: 2026-07-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260721_0005"
down_revision: Union[str, None] = "20260714_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cursos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("importador_id", sa.String(36), sa.ForeignKey("importadores.id"), nullable=False),
        sa.Column("creado_por_usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("categoria", sa.String(100), nullable=True),
        sa.Column("precio_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("imagen_url", sa.String(500), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_cursos_importador_id", "cursos", ["importador_id"])
    op.create_index("ix_cursos_categoria", "cursos", ["categoria"])
    op.create_index("ix_cursos_estado", "cursos", ["estado"])

    op.create_table(
        "curso_lecciones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo", sa.String(20), nullable=False, server_default="video"),
        sa.Column("contenido_url", sa.String(500), nullable=True),
        sa.Column("contenido_texto", sa.Text(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duracion_segundos", sa.Integer(), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("curso_id", "orden", name="uq_curso_leccion_orden"),
    )
    op.create_index("ix_curso_lecciones_curso_id", "curso_lecciones", ["curso_id"])

    op.create_table(
        "compras_curso",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("comprador_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("precio_pagado_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("wompi_payment_id", sa.String(100), nullable=True),
        sa.Column("checkout_url", sa.String(500), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_confirmacion", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("curso_id", "comprador_id", name="uq_compra_curso_comprador"),
    )
    op.create_index("ix_compras_curso_curso_id", "compras_curso", ["curso_id"])
    op.create_index("ix_compras_curso_comprador_id", "compras_curso", ["comprador_id"])
    op.create_index("ix_compras_curso_estado", "compras_curso", ["estado"])
    op.create_index("ix_compras_curso_wompi_payment_id", "compras_curso", ["wompi_payment_id"], unique=True)

    op.create_table(
        "progreso_lecciones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("leccion_id", sa.String(36), sa.ForeignKey("curso_lecciones.id"), nullable=False),
        sa.Column("compra_id", sa.String(36), sa.ForeignKey("compras_curso.id"), nullable=False),
        sa.Column("completada", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("fecha_completada", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("usuario_id", "leccion_id", name="uq_progreso_usuario_leccion"),
    )
    op.create_index("ix_progreso_lecciones_usuario_id", "progreso_lecciones", ["usuario_id"])
    op.create_index("ix_progreso_lecciones_curso_id", "progreso_lecciones", ["curso_id"])
    op.create_index("ix_progreso_lecciones_leccion_id", "progreso_lecciones", ["leccion_id"])
    op.create_index("ix_progreso_lecciones_compra_id", "progreso_lecciones", ["compra_id"])


def downgrade() -> None:
    op.drop_table("progreso_lecciones")
    op.drop_table("compras_curso")
    op.drop_table("curso_lecciones")
    op.drop_table("cursos")
