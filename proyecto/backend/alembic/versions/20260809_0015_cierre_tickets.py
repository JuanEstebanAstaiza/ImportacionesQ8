"""Cierre de tickets de soporte.

Sin estado de cierre la bandeja solo crece: todo lo atendido seguía apareciendo
como pendiente y no quedaba constancia de qué se hizo. Se cierra dejando la
resolución escrita y quién la aplicó; el hilo no se borra para poder consultarlo
si el problema reaparece.

Revision ID: 20260809_0015
Revises: 20260809_0014
Create Date: 2026-08-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260809_0015"
down_revision: Union[str, None] = "20260809_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "conversaciones_chat"


def _columnas() -> dict:
    return {c["name"]: c for c in sa.inspect(op.get_bind()).get_columns(TABLA)}


def upgrade() -> None:
    columnas = _columnas()

    if "cerrada" not in columnas:
        op.add_column(
            TABLA,
            sa.Column("cerrada", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if "resolucion" not in columnas:
        op.add_column(TABLA, sa.Column("resolucion", sa.Text(), nullable=True))
    if "cerrada_por_usuario_id" not in columnas:
        op.add_column(TABLA, sa.Column("cerrada_por_usuario_id", sa.String(length=36), nullable=True))
        op.create_foreign_key(
            "fk_conversaciones_chat_cerrada_por",
            TABLA,
            "usuarios",
            ["cerrada_por_usuario_id"],
            ["id"],
        )
    if "fecha_cierre" not in columnas:
        op.add_column(TABLA, sa.Column("fecha_cierre", sa.DateTime(), nullable=True))


def downgrade() -> None:
    columnas = _columnas()

    if "fecha_cierre" in columnas:
        op.drop_column(TABLA, "fecha_cierre")
    if "cerrada_por_usuario_id" in columnas:
        try:
            op.drop_constraint("fk_conversaciones_chat_cerrada_por", TABLA, type_="foreignkey")
        except Exception:
            pass
        op.drop_column(TABLA, "cerrada_por_usuario_id")
    if "resolucion" in columnas:
        op.drop_column(TABLA, "resolucion")
    if "cerrada" in columnas:
        op.drop_column(TABLA, "cerrada")
