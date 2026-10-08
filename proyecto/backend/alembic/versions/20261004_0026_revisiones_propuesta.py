"""Revisiones de una propuesta ya enviada, visibles para el comprador.

Una empresa puede ajustar su propuesta después de enviarla para reflejar lo
negociado por chat. Eso se mantiene, pero el comprador tiene que poder ver que
lo que está comparando ya no es la oferta original:

- `propuestas.revisiones`: cuántas veces se reescribió después de enviarla
  (0 = tal como llegó). La versión que se muestra es `revisiones + 1`.
- `propuestas.fecha_modificacion`: cuándo fue el último cambio (NULL si nunca).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261004_0026"
down_revision: Union[str, None] = "20261003_0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def upgrade() -> None:
    columnas = _columnas("propuestas")

    if "revisiones" not in columnas:
        op.add_column(
            "propuestas",
            sa.Column("revisiones", sa.Integer(), nullable=False, server_default="0"),
        )

    if "fecha_modificacion" not in columnas:
        op.add_column("propuestas", sa.Column("fecha_modificacion", sa.DateTime(), nullable=True))

    # Las propuestas que ya existen se dan por no modificadas: no hay forma de
    # reconstruir cuántas veces se tocaron antes de que existiera el contador, y
    # tratarlas como originales es lo que menos engaña al comprador.


def downgrade() -> None:
    columnas = _columnas("propuestas")
    if "fecha_modificacion" in columnas:
        op.drop_column("propuestas", "fecha_modificacion")
    if "revisiones" in columnas:
        op.drop_column("propuestas", "revisiones")
