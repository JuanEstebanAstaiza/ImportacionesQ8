"""Tendencias: descripción del producto.

`tendencias_items.descripcion`: texto largo de la ficha (qué es, materiales,
usos). Lo escribe el equipo al subir productos a su catálogo desde el admin.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261010_0035"
down_revision: Union[str, None] = "20261009_0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    if "descripcion" not in _columnas("tendencias_items"):
        op.add_column("tendencias_items", sa.Column("descripcion", sa.Text(), nullable=True))


def downgrade() -> None:
    if "descripcion" in _columnas("tendencias_items"):
        op.drop_column("tendencias_items", "descripcion")
