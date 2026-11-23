"""Agregar soporte para archivado de chats y nuevo tipo liquidacion_operacion.

Cambios:
- Agregar columna 'archivada_por' (JSON) a conversaciones_chat para rastrear
  qué usuario tiene archivado el chat.
- El archivo es una preferencia individual: no afecta a otros participantes.

Revision ID: 20261120_0047
Revises: 20261109_0046
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261120_0047"
down_revision: Union[str, None] = "20261109_0046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columnas = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("conversaciones_chat")}
    if "archivada_por" not in columnas:
        op.add_column(
            "conversaciones_chat",
            sa.Column("archivada_por", sa.JSON, nullable=True)
        )


def downgrade() -> None:
    op.drop_column("conversaciones_chat", "archivada_por")
