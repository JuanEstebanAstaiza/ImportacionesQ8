"""Gestión documental, adjuntos chat, recursos curso y soft delete.

Revision ID: 20260804_0006
Revises: 20260728_0005
Create Date: 2026-08-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260804_0006"
down_revision: Union[str, None] = "20260728_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cursos", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("recursos_leccion", sa.Column("deleted_at", sa.DateTime(), nullable=True))

    op.create_table(
        "carpetas",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("parent_id", sa.String(36), sa.ForeignKey("carpetas.id"), nullable=True),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_carpetas_owner_user_id", "carpetas", ["owner_user_id"])
    op.create_index("ix_carpetas_parent_id", "carpetas", ["parent_id"])

    op.create_table(
        "archivos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("carpeta_id", sa.String(36), sa.ForeignKey("carpetas.id"), nullable=True),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("extension", sa.String(12), nullable=False),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("tipo_recurso", sa.String(20), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("storage_url", sa.String(500), nullable=True),
        sa.Column("storage_path", sa.String(500), nullable=True),
        sa.Column("origen", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_archivos_owner_user_id", "archivos", ["owner_user_id"])
    op.create_index("ix_archivos_carpeta_id", "archivos", ["carpeta_id"])
    op.create_index("ix_archivos_tipo_recurso", "archivos", ["tipo_recurso"])
    op.create_index("ix_archivos_owner_parent_deleted", "archivos", ["owner_user_id", "carpeta_id", "deleted_at"])
    op.create_index("ix_archivos_owner_tipo_deleted", "archivos", ["owner_user_id", "tipo_recurso", "deleted_at"])

    op.create_table(
        "etiquetas",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("color", sa.String(24), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("owner_user_id", "nombre", name="uq_etiqueta_owner_nombre"),
    )
    op.create_index("ix_etiquetas_owner_user_id", "etiquetas", ["owner_user_id"])

    op.create_table(
        "archivo_etiquetas",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("archivo_id", sa.String(36), sa.ForeignKey("archivos.id"), nullable=False),
        sa.Column("etiqueta_id", sa.String(36), sa.ForeignKey("etiquetas.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("archivo_id", "etiqueta_id", name="uq_archivo_etiqueta"),
    )
    op.create_index("ix_archivo_etiquetas_archivo_id", "archivo_etiquetas", ["archivo_id"])
    op.create_index("ix_archivo_etiquetas_etiqueta_id", "archivo_etiquetas", ["etiqueta_id"])

    op.create_table(
        "favoritos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_user_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("recurso_tipo", sa.String(20), nullable=False),
        sa.Column("recurso_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("owner_user_id", "recurso_tipo", "recurso_id", name="uq_favorito_recurso"),
    )
    op.create_index("ix_favoritos_owner_user_id", "favoritos", ["owner_user_id"])
    op.create_index("ix_favorito_owner_deleted", "favoritos", ["owner_user_id", "deleted_at"])

    op.create_table(
        "curso_recursos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("curso_id", sa.String(36), sa.ForeignKey("cursos.id"), nullable=False),
        sa.Column("leccion_id", sa.String(36), sa.ForeignKey("lecciones_curso.id"), nullable=True),
        sa.Column("archivo_id", sa.String(36), sa.ForeignKey("archivos.id"), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False, server_default="material"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("curso_id", "leccion_id", "archivo_id", name="uq_curso_leccion_archivo"),
    )
    op.create_index("ix_curso_recursos_curso_id", "curso_recursos", ["curso_id"])
    op.create_index("ix_curso_recursos_leccion_id", "curso_recursos", ["leccion_id"])
    op.create_index("ix_curso_recursos_archivo_id", "curso_recursos", ["archivo_id"])
    op.create_index("ix_curso_recurso_archivo_deleted", "curso_recursos", ["archivo_id", "deleted_at"])

    op.create_table(
        "mensajes_adjuntos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("mensaje_id", sa.String(36), sa.ForeignKey("mensajes_chat.id"), nullable=False),
        sa.Column("archivo_id", sa.String(36), sa.ForeignKey("archivos.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("mensaje_id", "archivo_id", name="uq_mensaje_archivo"),
    )
    op.create_index("ix_mensajes_adjuntos_mensaje_id", "mensajes_adjuntos", ["mensaje_id"])
    op.create_index("ix_mensajes_adjuntos_archivo_id", "mensajes_adjuntos", ["archivo_id"])

    op.create_table(
        "orden_documentos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("orden_id", sa.String(36), sa.ForeignKey("ordenes.id"), nullable=False),
        sa.Column("archivo_id", sa.String(36), sa.ForeignKey("archivos.id"), nullable=False),
        sa.Column("tipo", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("orden_id", "archivo_id", name="uq_orden_archivo"),
    )
    op.create_index("ix_orden_documentos_orden_id", "orden_documentos", ["orden_id"])
    op.create_index("ix_orden_documentos_archivo_id", "orden_documentos", ["archivo_id"])


def downgrade() -> None:
    op.drop_table("orden_documentos")
    op.drop_table("mensajes_adjuntos")
    op.drop_table("curso_recursos")
    op.drop_table("favoritos")
    op.drop_table("archivo_etiquetas")
    op.drop_table("etiquetas")
    op.drop_table("archivos")
    op.drop_table("carpetas")
    op.drop_column("recursos_leccion", "deleted_at")
    op.drop_column("cursos", "deleted_at")
