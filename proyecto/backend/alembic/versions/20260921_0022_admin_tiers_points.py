"""Añade overrides de tier, umbrales y movimientos administrativos de puntos."""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260921_0022"
down_revision: Union[str, None] = "20260921_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    usuarios = {c["name"] for c in inspector.get_columns("usuarios")}
    if "tier_manual" not in usuarios:
        op.add_column("usuarios", sa.Column("tier_manual", sa.Boolean(), nullable=False, server_default=sa.false()))

    tablas = inspector.get_table_names()
    if "umbrales_tier_cotizante" not in tablas:
        op.create_table(
            "umbrales_tier_cotizante",
            sa.Column("tier", sa.String(length=10), primary_key=True),
            sa.Column("minimo_cotizaciones", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("minimo_ordenes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("minimo_valor_operaciones_usd", sa.Float(), nullable=False, server_default="0"),
            sa.Column("actualizado_por_admin_id", sa.String(length=36), nullable=True),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["actualizado_por_admin_id"], ["usuarios.id"]),
        )
        op.bulk_insert(
            sa.table(
                "umbrales_tier_cotizante",
                sa.column("tier", sa.String()),
                sa.column("minimo_cotizaciones", sa.Integer()),
                sa.column("minimo_ordenes", sa.Integer()),
                sa.column("minimo_valor_operaciones_usd", sa.Float()),
            ),
            [
                {"tier": "Bronze", "minimo_cotizaciones": 0, "minimo_ordenes": 0, "minimo_valor_operaciones_usd": 0},
                {"tier": "Silver", "minimo_cotizaciones": 5, "minimo_ordenes": 1, "minimo_valor_operaciones_usd": 1000},
                {"tier": "Gold", "minimo_cotizaciones": 15, "minimo_ordenes": 3, "minimo_valor_operaciones_usd": 10000},
                {"tier": "Élite", "minimo_cotizaciones": 30, "minimo_ordenes": 10, "minimo_valor_operaciones_usd": 50000},
            ],
        )

    if "movimientos_puntos_cotizacion" not in tablas:
        op.create_table(
            "movimientos_puntos_cotizacion",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("usuario_id", sa.String(length=36), nullable=False),
            sa.Column("admin_id", sa.String(length=36), nullable=True),
            sa.Column("cotizacion_id", sa.String(length=36), nullable=True),
            sa.Column("tipo", sa.String(length=20), nullable=False),
            sa.Column("delta", sa.Integer(), nullable=False),
            sa.Column("saldo_resultante", sa.Integer(), nullable=False),
            sa.Column("descripcion", sa.Text(), nullable=True),
            sa.Column("fecha", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["admin_id"], ["usuarios.id"]),
            sa.ForeignKeyConstraint(["cotizacion_id"], ["cotizaciones.id"]),
        )


def downgrade() -> None:
    op.drop_table("movimientos_puntos_cotizacion")
    op.drop_table("umbrales_tier_cotizante")
    op.drop_column("usuarios", "tier_manual")