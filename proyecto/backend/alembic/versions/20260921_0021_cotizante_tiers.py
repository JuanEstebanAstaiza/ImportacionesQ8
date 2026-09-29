"""Añade tiers, puntos de cotización y requisito mínimo a las cotizaciones."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260921_0021"
down_revision: Union[str, None] = "20260908_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def upgrade() -> None:
    usuarios = _columnas("usuarios")
    cotizaciones = _columnas("cotizaciones")
    if "tier" not in usuarios:
        op.add_column("usuarios", sa.Column("tier", sa.String(length=10), nullable=False, server_default="Bronze"))
    if "puntos_cotizacion" not in usuarios:
        op.add_column("usuarios", sa.Column("puntos_cotizacion", sa.Integer(), nullable=False, server_default="0"))
    if "tier_minimo_requerido" not in cotizaciones:
        op.add_column("cotizaciones", sa.Column("tier_minimo_requerido", sa.String(length=10), nullable=False, server_default="Bronze"))
    if "desbloqueada_por_puntos" not in cotizaciones:
        op.add_column("cotizaciones", sa.Column("desbloqueada_por_puntos", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    cotizaciones = _columnas("cotizaciones")
    usuarios = _columnas("usuarios")
    if "desbloqueada_por_puntos" in cotizaciones:
        op.drop_column("cotizaciones", "desbloqueada_por_puntos")
    if "tier_minimo_requerido" in cotizaciones:
        op.drop_column("cotizaciones", "tier_minimo_requerido")
    if "puntos_cotizacion" in usuarios:
        op.drop_column("usuarios", "puntos_cotizacion")
    if "tier" in usuarios:
        op.drop_column("usuarios", "tier")