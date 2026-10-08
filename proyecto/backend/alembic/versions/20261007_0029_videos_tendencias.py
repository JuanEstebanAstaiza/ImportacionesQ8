"""Videos de los productos de Tendencias, en encuadre horizontal y vertical.

- `tendencias_productos.video_horizontal`: 16:9, para pantallas anchas.
- `tendencias_productos.video_vertical`: 9:16, para celulares.

Ambos opcionales. La interfaz elige según la pantalla y, si solo hay uno,
muestra ese en todas.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261007_0029"
down_revision: Union[str, None] = "20261006_0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    columnas = _columnas("tendencias_productos")
    for nombre in ("video_horizontal", "video_vertical"):
        if nombre not in columnas:
            op.add_column("tendencias_productos", sa.Column(nombre, sa.String(length=500), nullable=True))


def downgrade() -> None:
    columnas = _columnas("tendencias_productos")
    for nombre in ("video_vertical", "video_horizontal"):
        if nombre in columnas:
            op.drop_column("tendencias_productos", nombre)
