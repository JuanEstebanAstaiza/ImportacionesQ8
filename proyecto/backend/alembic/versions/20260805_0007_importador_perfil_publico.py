"""Agregar perfil_publico JSON a importadores.

Revision ID: 20260805_0007
Revises: 20260804_0006
Create Date: 2026-08-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260805_0007"
down_revision: Union[str, None] = "20260804_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("importadores", sa.Column("perfil_publico", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("importadores", "perfil_publico")
