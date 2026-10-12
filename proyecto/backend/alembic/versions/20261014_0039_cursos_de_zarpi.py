"""Cursos propios de Zarpi: `cursos.importador_id` admite vacío.

Los crea el admin desde *Admin › Cursos de Zarpi*; en el catálogo salen como
publicados por «Zarpi».
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261014_0039"
down_revision: Union[str, None] = "20261013_0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _nullable(tabla: str, columna: str) -> bool:
    for c in sa.inspect(op.get_bind()).get_columns(tabla):
        if c["name"] == columna:
            return bool(c["nullable"])
    return True


def upgrade() -> None:
    if not _nullable("cursos", "importador_id"):
        op.alter_column("cursos", "importador_id", existing_type=sa.String(length=36), nullable=True)


def downgrade() -> None:
    # Solo se puede volver atrás si no quedan cursos de Zarpi.
    if _nullable("cursos", "importador_id"):
        op.alter_column("cursos", "importador_id", existing_type=sa.String(length=36), nullable=False)
