"""Features de valor: evidencias, orgs, disputas, referidos, traducción.

Revision ID: 20260713_0002
Revises: 20260713_0001
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0002"
down_revision: Union[str, None] = "20260713_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizaciones_solicitantes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("razon_social", sa.String(255), nullable=False),
        sa.Column("nit", sa.String(50), nullable=False),
        sa.Column("creditos_balance", sa.Float(), nullable=False, server_default="0"),
        sa.Column("owner_usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_organizaciones_solicitantes_nit", "organizaciones_solicitantes", ["nit"])

    op.create_table(
        "miembros_organizacion",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organizacion_id", sa.String(36), sa.ForeignKey("organizaciones_solicitantes.id"), nullable=False),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("rol_org", sa.String(20), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("fecha_alta", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("organizacion_id", "usuario_id", name="unique_miembro_org_usuario"),
    )
    op.create_index("ix_miembros_organizacion_org", "miembros_organizacion", ["organizacion_id"])
    op.create_index("ix_miembros_organizacion_user", "miembros_organizacion", ["usuario_id"])

    op.add_column(
        "usuarios",
        sa.Column("organizacion_id", sa.String(36), sa.ForeignKey("organizaciones_solicitantes.id"), nullable=True),
    )
    op.create_index("ix_usuarios_organizacion_id", "usuarios", ["organizacion_id"])

    op.add_column(
        "movimientos_credito",
        sa.Column("organizacion_id", sa.String(36), sa.ForeignKey("organizaciones_solicitantes.id"), nullable=True),
    )
    op.create_index("ix_movimientos_credito_org", "movimientos_credito", ["organizacion_id"])

    op.add_column("mensajes_chat", sa.Column("metadata", sa.JSON(), nullable=True))

    op.create_table(
        "evidencias_importador",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("importador_id", sa.String(36), sa.ForeignKey("importadores.id"), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("titulo", sa.String(255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("revisado_por_admin_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("nota_revision", sa.Text(), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_revision", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_evidencias_importador_imp", "evidencias_importador", ["importador_id"])

    op.create_table(
        "disputas",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("orden_id", sa.String(36), sa.ForeignKey("ordenes.id"), nullable=False, unique=True),
        sa.Column("abierta_por_usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="abierta"),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("resolucion_admin", sa.Text(), nullable=True),
        sa.Column("resuelta_por_admin_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("fecha_apertura", sa.DateTime(), nullable=True),
        sa.Column("fecha_resolucion", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "evidencias_disputa",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("disputa_id", sa.String(36), sa.ForeignKey("disputas.id"), nullable=False),
        sa.Column("subido_por_usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False, server_default="documento"),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("fecha", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_evidencias_disputa_disp", "evidencias_disputa", ["disputa_id"])

    op.create_table(
        "mensajes_disputa",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("disputa_id", sa.String(36), sa.ForeignKey("disputas.id"), nullable=False),
        sa.Column("autor_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False, server_default="texto"),
        sa.Column("fecha", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_mensajes_disputa_disp", "mensajes_disputa", ["disputa_id"])

    op.create_table(
        "codigos_referido",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False, unique=True),
        sa.Column("codigo", sa.String(32), nullable=False, unique=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_codigos_referido_codigo", "codigos_referido", ["codigo"])

    op.create_table(
        "referidos_uso",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("codigo_id", sa.String(36), sa.ForeignKey("codigos_referido.id"), nullable=False),
        sa.Column("usuario_referido_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("bono_referidor", sa.Float(), nullable=False, server_default="0"),
        sa.Column("bono_referido", sa.Float(), nullable=False, server_default="0"),
        sa.Column("fecha", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("usuario_referido_id", name="unique_usuario_referido"),
    )

    op.create_table(
        "traducciones_cache",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("hash_texto", sa.String(64), nullable=False),
        sa.Column("idioma_origen", sa.String(16), nullable=False),
        sa.Column("idioma_destino", sa.String(16), nullable=False),
        sa.Column("texto_traducido", sa.Text(), nullable=False),
        sa.Column("fecha", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("hash_texto", "idioma_origen", "idioma_destino", name="unique_traduccion_cache"),
    )
    op.create_index("ix_traducciones_cache_hash", "traducciones_cache", ["hash_texto"])


def downgrade() -> None:
    op.drop_table("traducciones_cache")
    op.drop_table("referidos_uso")
    op.drop_table("codigos_referido")
    op.drop_table("mensajes_disputa")
    op.drop_table("evidencias_disputa")
    op.drop_table("disputas")
    op.drop_table("evidencias_importador")
    op.drop_column("mensajes_chat", "metadata")
    op.drop_index("ix_movimientos_credito_org", table_name="movimientos_credito")
    op.drop_column("movimientos_credito", "organizacion_id")
    op.drop_index("ix_usuarios_organizacion_id", table_name="usuarios")
    op.drop_column("usuarios", "organizacion_id")
    op.drop_table("miembros_organizacion")
    op.drop_table("organizaciones_solicitantes")
