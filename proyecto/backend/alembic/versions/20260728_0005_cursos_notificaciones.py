"""Cursos LMS, notificaciones in-app.

Revision ID: 20260728_0005
Revises: 20260714_0004
Create Date: 2026-07-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260728_0005"
down_revision: Union[str, None] = "20260714_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cursos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("slug", sa.String(280), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("portada_url", sa.String(500), nullable=True),
        sa.Column("precio", sa.Float(), nullable=False, server_default="0"),
        sa.Column("nivel", sa.String(30), nullable=False),
        sa.Column("categoria", sa.String(120), nullable=False),
        sa.Column("importador_id", sa.String(36), sa.ForeignKey("importadores.id"), nullable=False),
        sa.Column("creado_por_usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("rating", sa.Float(), nullable=False, server_default="0"),
        sa.Column("estudiantes_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="publicado"),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_cursos_slug", "cursos", ["slug"], unique=True)
    op.create_index("ix_cursos_categoria", "cursos", ["categoria"])
    op.create_index("ix_cursos_importador_id", "cursos", ["importador_id"])
    op.create_index("ix_cursos_estado", "cursos", ["estado"])

    op.create_table(
        "modulos_curso",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_modulos_curso_curso_id", "modulos_curso", ["curso_id"])

    op.create_table(
        "lecciones_curso",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("modulo_id", sa.String(36), sa.ForeignKey("modulos_curso.id"), nullable=False),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("duracion", sa.String(30), nullable=False),
        sa.Column("video_url", sa.String(500), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("es_preview", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_lecciones_curso_modulo_id", "lecciones_curso", ["modulo_id"])
    op.create_index("ix_lecciones_curso_curso_id", "lecciones_curso", ["curso_id"])

    op.create_table(
        "recursos_leccion",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("leccion_id", sa.String(36), sa.ForeignKey("lecciones_curso.id"), nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
    )
    op.create_index("ix_recursos_leccion_leccion_id", "recursos_leccion", ["leccion_id"])

    op.create_table(
        "compras_curso",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("precio_pagado", sa.Float(), nullable=False, server_default="0"),
        sa.Column("fecha_compra", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("curso_id", "usuario_id", name="unique_compra_curso_usuario"),
    )
    op.create_index("ix_compras_curso_curso_id", "compras_curso", ["curso_id"])
    op.create_index("ix_compras_curso_usuario", "compras_curso", ["usuario_id"])

    op.create_table(
        "progreso_lecciones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("leccion_id", sa.String(36), sa.ForeignKey("lecciones_curso.id"), nullable=False),
        sa.Column("completada", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fecha_completado", sa.DateTime(), nullable=True),
        sa.Column("fecha_ultima_vista", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("usuario_id", "leccion_id", name="unique_progreso_usuario_leccion"),
    )
    op.create_index("ix_progreso_usuario_curso", "progreso_lecciones", ["usuario_id", "curso_id"])

    op.create_table(
        "notificaciones",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("tipo", sa.String(40), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("leida", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_lectura", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_notificaciones_usuario_id", "notificaciones", ["usuario_id"])
    op.create_index("ix_notificaciones_usuario_leida", "notificaciones", ["usuario_id", "leida"])
    op.create_index("ix_notificaciones_usuario_fecha", "notificaciones", ["usuario_id", "fecha_creacion"])


def downgrade() -> None:
    op.drop_table("notificaciones")
    op.drop_table("progreso_lecciones")
    op.drop_table("compras_curso")
    op.drop_table("recursos_leccion")
    op.drop_table("lecciones_curso")
    op.drop_table("modulos_curso")
    op.drop_table("cursos")
