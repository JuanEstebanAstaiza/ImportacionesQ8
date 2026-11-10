"""Tickets de la mesa de ayuda con el producto de la suite del que vienen.

Zarpi pasa a ser una suite (Importaciones, Liquidaciones...). La mesa de ayuda
sigue siendo una sola, pero cada ticket dice de qué producto viene y, si se
abrió desde algo concreto, sobre qué («operacion:<id>»). Los tickets anteriores
quedan con NULL y se leen como de Importaciones.

Revision ID: 20261024_0045
Revises: 20261018_0044
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_0045"
down_revision: Union[str, None] = "20261018_0044"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columnas = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("conversaciones_chat")}
    if "modulo" not in columnas:
        op.add_column("conversaciones_chat", sa.Column("modulo", sa.String(length=30), nullable=True))
        op.create_index("ix_conversaciones_chat_modulo", "conversaciones_chat", ["modulo"])
    if "referencia" not in columnas:
        op.add_column("conversaciones_chat", sa.Column("referencia", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_index("ix_conversaciones_chat_modulo", table_name="conversaciones_chat")
    op.drop_column("conversaciones_chat", "referencia")
    op.drop_column("conversaciones_chat", "modulo")
