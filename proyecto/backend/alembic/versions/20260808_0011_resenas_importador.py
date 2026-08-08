"""Reseñas de empresas importadoras.

`Importador.calificacion_promedio` existía desde el esquema inicial pero nadie
la escribía. Esta tabla es la fuente real de esa nota: una reseña por orden
entregada, con desglose opcional, derecho de réplica de la empresa y moderación
por ocultación (nunca borrado, para no perder la trazabilidad).

Revision ID: 20260808_0011
Revises: 20260807_0010
Create Date: 2026-08-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260808_0011"
down_revision: Union[str, None] = "20260807_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "resenas_importador"


def _existe_tabla(nombre: str) -> bool:
    return nombre in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    # La revisión inicial hace `create_all` de los modelos actuales, así que en
    # una base recién creada la tabla ya existe.
    if _existe_tabla(TABLA):
        return

    op.create_table(
        TABLA,
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("importador_id", sa.String(length=36), nullable=False),
        sa.Column("autor_usuario_id", sa.String(length=36), nullable=False),
        sa.Column("orden_id", sa.String(length=36), nullable=False),
        sa.Column("calificacion", sa.Integer(), nullable=False),
        sa.Column("comentario", sa.Text(), nullable=True),
        sa.Column("puntualidad", sa.Integer(), nullable=True),
        sa.Column("calidad_producto", sa.Integer(), nullable=True),
        sa.Column("comunicacion", sa.Integer(), nullable=True),
        sa.Column("respuesta_empresa", sa.Text(), nullable=True),
        sa.Column("fecha_respuesta", sa.DateTime(), nullable=True),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("motivo_ocultacion", sa.Text(), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["importador_id"], ["importadores.id"]),
        sa.ForeignKeyConstraint(["autor_usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["orden_id"], ["ordenes.id"]),
        sa.PrimaryKeyConstraint("id"),
        # Una orden se reseña una sola vez: sin esto, un mismo trato podría
        # inflar o hundir la nota de la empresa repitiendo la opinión.
        sa.UniqueConstraint("orden_id", name="unique_resena_por_orden"),
    )
    op.create_index(op.f("ix_resenas_importador_importador_id"), TABLA, ["importador_id"])
    op.create_index(op.f("ix_resenas_importador_autor_usuario_id"), TABLA, ["autor_usuario_id"])


def downgrade() -> None:
    if not _existe_tabla(TABLA):
        return
    op.drop_index(op.f("ix_resenas_importador_autor_usuario_id"), table_name=TABLA)
    op.drop_index(op.f("ix_resenas_importador_importador_id"), table_name=TABLA)
    op.drop_table(TABLA)
