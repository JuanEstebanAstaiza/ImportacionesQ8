"""Ajusta el modelo de cotización para moneda y default de incoterm.

Revision ID: 20260831_0018
Revises: 20260810_0017
Create Date: 2026-08-31
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260831_0018"
down_revision: Union[str, None] = "20260810_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {c["name"] for c in inspector.get_columns(tabla)}


def upgrade() -> None:
    if "moneda_precio_objetivo" not in _columnas("cotizaciones"):
        op.add_column(
            "cotizaciones",
            sa.Column("moneda_precio_objetivo", sa.String(length=10), nullable=False, server_default="USD"),
        )

    op.execute(
        sa.text("UPDATE cotizaciones SET moneda_precio_objetivo = 'USD' WHERE moneda_precio_objetivo IS NULL OR TRIM(moneda_precio_objetivo) = ''")
    )

    if "incoterm" in _columnas("cotizaciones"):
        op.execute(
            sa.text("UPDATE cotizaciones SET incoterm = 'DDP' WHERE incoterm IS NULL OR TRIM(incoterm) = ''")
        )


def downgrade() -> None:
    if "moneda_precio_objetivo" in _columnas("cotizaciones"):
        op.drop_column("cotizaciones", "moneda_precio_objetivo")
