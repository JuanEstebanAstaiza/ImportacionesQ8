"""Rechazo de cotizaciones por la empresa, con motivo.

1. `recepciones_cotizacion`: quién la rechazó, cuándo y por qué. Una abierta
   rechazada sale de la bandeja de esa empresa (y sigue para las demás).
2. `cotizaciones.motivo_rechazo`: el motivo que ve el cotizante cuando la
   empresa a la que iba dirigida la rechaza (la cotización pasa a «rechazada»).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261012_0037"
down_revision: Union[str, None] = "20261011_0036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    existentes = _columnas("recepciones_cotizacion")
    if "rechazada_en" not in existentes:
        op.add_column("recepciones_cotizacion", sa.Column("rechazada_en", sa.DateTime(), nullable=True))
    if "rechazada_por" not in existentes:
        op.add_column("recepciones_cotizacion", sa.Column("rechazada_por", sa.String(length=36), nullable=True))
    if "motivo_rechazo" not in existentes:
        op.add_column("recepciones_cotizacion", sa.Column("motivo_rechazo", sa.Text(), nullable=True))
    if "motivo_rechazo" not in _columnas("cotizaciones"):
        op.add_column("cotizaciones", sa.Column("motivo_rechazo", sa.Text(), nullable=True))


def downgrade() -> None:
    if "motivo_rechazo" in _columnas("cotizaciones"):
        op.drop_column("cotizaciones", "motivo_rechazo")
    existentes = _columnas("recepciones_cotizacion")
    for columna in ("motivo_rechazo", "rechazada_por", "rechazada_en"):
        if columna in existentes:
            op.drop_column("recepciones_cotizacion", columna)
