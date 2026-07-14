"""OWASP remediations: JWT blacklist, unique compra por pago.

Revision ID: 20260714_0004
Revises: 20260713_0003
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260714_0004"
down_revision: Union[str, None] = "20260713_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "jwt_blacklist",
        sa.Column("jti", sa.String(64), primary_key=True),
        sa.Column("usuario_id", sa.String(36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("expira_en", sa.DateTime(), nullable=False),
        sa.Column("fecha_revocacion", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_jwt_blacklist_usuario_id", "jwt_blacklist", ["usuario_id"])
    op.create_index("ix_jwt_blacklist_expira_en", "jwt_blacklist", ["expira_en"])


def downgrade() -> None:
    op.drop_index("ix_jwt_blacklist_expira_en", table_name="jwt_blacklist")
    op.drop_index("ix_jwt_blacklist_usuario_id", table_name="jwt_blacklist")
    op.drop_table("jwt_blacklist")
