"""Shipping mark: prefijo de la empresa + sufijo del cliente.

La marca de embarque que va rotulada en las cajas se compone de dos partes que
viven en sitios distintos: el prefijo es fijo por empresa importadora y el
sufijo lo aporta el cliente en cada cotización. La orden guarda el resultado ya
compuesto para que un cambio posterior de prefijo no reescriba embarques ya
rotulados.

Revision ID: 20260807_0010
Revises: 20260806_0009
Create Date: 2026-08-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260807_0010"
down_revision: Union[str, None] = "20260806_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {c["name"] for c in inspector.get_columns(tabla)}


def upgrade() -> None:
    # La revisión inicial hace `create_all` de los modelos actuales, así que en
    # una base recién creada estas columnas ya existen. Se comprueba antes de
    # añadirlas para no romper ese camino.
    if "shipping_mark_prefijo" not in _columnas("importadores"):
        op.add_column("importadores", sa.Column("shipping_mark_prefijo", sa.String(length=12), nullable=True))

    if "shipping_mark_sufijo" not in _columnas("cotizaciones"):
        op.add_column("cotizaciones", sa.Column("shipping_mark_sufijo", sa.String(length=40), nullable=True))

    if "shipping_mark" not in _columnas("ordenes"):
        op.add_column("ordenes", sa.Column("shipping_mark", sa.String(length=60), nullable=True))


def downgrade() -> None:
    if "shipping_mark" in _columnas("ordenes"):
        op.drop_column("ordenes", "shipping_mark")

    if "shipping_mark_sufijo" in _columnas("cotizaciones"):
        op.drop_column("cotizaciones", "shipping_mark_sufijo")

    if "shipping_mark_prefijo" in _columnas("importadores"):
        op.drop_column("importadores", "shipping_mark_prefijo")
