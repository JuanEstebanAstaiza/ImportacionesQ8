"""Límite diario de cotizaciones recibidas por empresa importadora.

- `importadores.limite_cotizaciones_diarias`: tope que fija la empresa (NULL =
  sin límite).
- `recepciones_cotizacion`: cada cotización que llegó (o que el matching dejó
  fuera por cupo) a cada empresa; es lo que cuenta el cupo del día.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260930_0024"
down_revision: Union[str, None] = "20260929_0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def _tablas() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    if "limite_cotizaciones_diarias" not in _columnas("importadores"):
        op.add_column("importadores", sa.Column("limite_cotizaciones_diarias", sa.Integer(), nullable=True))

    if "recepciones_cotizacion" not in _tablas():
        op.create_table(
            "recepciones_cotizacion",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("importador_id", sa.String(length=36), sa.ForeignKey("importadores.id"), nullable=False),
            sa.Column("cotizacion_id", sa.String(length=36), sa.ForeignKey("cotizaciones.id"), nullable=False),
            sa.Column("modalidad", sa.String(length=20), nullable=False),
            sa.Column("entregada", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("fecha_recepcion", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("importador_id", "cotizacion_id", name="uq_recepcion_importador_cotizacion"),
        )
        op.create_index(
            "ix_recepciones_importador_fecha",
            "recepciones_cotizacion",
            ["importador_id", "fecha_recepcion"],
        )
        op.create_index("ix_recepciones_cotizacion_cotizacion_id", "recepciones_cotizacion", ["cotizacion_id"])


def downgrade() -> None:
    if "recepciones_cotizacion" in _tablas():
        op.drop_table("recepciones_cotizacion")
    if "limite_cotizaciones_diarias" in _columnas("importadores"):
        op.drop_column("importadores", "limite_cotizaciones_diarias")
