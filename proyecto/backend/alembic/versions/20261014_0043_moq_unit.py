"""Add MOQ unit to proposals.

Revision ID: 20261014_0043
Revises: 20261017_0042
"""

from alembic import op
import sqlalchemy as sa


revision = "20261014_0043"
down_revision = "20261017_0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("propuestas", sa.Column("moq_unit", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("propuestas", "moq_unit")
