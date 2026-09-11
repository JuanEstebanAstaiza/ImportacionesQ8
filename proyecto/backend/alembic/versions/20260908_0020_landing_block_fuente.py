"""Agrega la familia tipográfica de marca elegible por bloque de la Landing.

Revision ID: 20260908_0020
Revises: 20260908_0019
Create Date: 2026-09-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260908_0020"
down_revision: Union[str, None] = "20260908_0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {c["name"] for c in inspector.get_columns(tabla)}


def upgrade() -> None:
    if "landing_blocks" not in sa.inspect(op.get_bind()).get_table_names():
        return
    if "fuente" not in _columnas("landing_blocks"):
        op.add_column(
            "landing_blocks",
            sa.Column("fuente", sa.String(length=20), nullable=False, server_default="avenor"),
        )


def downgrade() -> None:
    if "landing_blocks" not in sa.inspect(op.get_bind()).get_table_names():
        return
    if "fuente" in _columnas("landing_blocks"):
        op.drop_column("landing_blocks", "fuente")
