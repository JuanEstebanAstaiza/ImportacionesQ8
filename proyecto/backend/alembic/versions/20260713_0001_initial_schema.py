"""Initial schema from SQLAlchemy models.

Revision ID: 20260713_0001
Revises:
Create Date: 2026-07-13

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260713_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_all es idempotente para el bootstrap inicial del MVP;
    # migraciones posteriores deben usar op.add_column / op.create_table explícitos.
    from database import Base
    import models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from database import Base
    import models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
