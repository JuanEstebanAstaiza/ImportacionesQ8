"""Galería de fotos del producto en la cotización.

El formulario solo dejaba adjuntar una foto (`cotizaciones.foto_producto`), y
para que la empresa cotice bien el comprador suele necesitar varias: el
producto, la etiqueta, el empaque, las medidas.

- `cotizaciones.fotos_producto` (JSON): lista de URLs en orden, hasta 10.
  `foto_producto` se conserva como portada (la primera de la lista).

Las cotizaciones existentes con foto pasan a tener una galería de un elemento.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261006_0027"
down_revision: Union[str, None] = "20261004_0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def upgrade() -> None:
    if "fotos_producto" not in _columnas("cotizaciones"):
        op.add_column("cotizaciones", sa.Column("fotos_producto", sa.JSON(), nullable=True))

    op.execute(
        "UPDATE cotizaciones SET fotos_producto = JSON_ARRAY(foto_producto) "
        "WHERE foto_producto IS NOT NULL AND foto_producto <> '' AND fotos_producto IS NULL"
    )


def downgrade() -> None:
    if "fotos_producto" in _columnas("cotizaciones"):
        op.drop_column("cotizaciones", "fotos_producto")
