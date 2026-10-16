"""Comprobantes del pago del cliente a la empresa por cada orden.

La orden nace como «orden generada · pago pendiente» (`cotizacion_aceptada`).
El cliente sube el comprobante a la carpeta de pagos de la operación y la
empresa lo confirma; solo entonces la orden puede pasar a producción.

Revision ID: 20261018_0044
Revises: 20261014_0043
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261018_0044"
down_revision: Union[str, None] = "20261014_0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if "comprobantes_pago_orden" in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        "comprobantes_pago_orden",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("orden_id", sa.String(length=36), sa.ForeignKey("ordenes.id"), nullable=False),
        sa.Column("archivo_id", sa.String(length=36), sa.ForeignKey("archivos.id"), nullable=False),
        sa.Column("subido_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("monto_cop", sa.Integer(), nullable=True),
        sa.Column("nota", sa.String(length=500), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("motivo_rechazo", sa.String(length=300), nullable=True),
        sa.Column("revisado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("revisado_en", sa.DateTime(), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_comprobantes_pago_orden_orden_id", "comprobantes_pago_orden", ["orden_id"])
    op.create_index("ix_comprobantes_pago_orden_archivo_id", "comprobantes_pago_orden", ["archivo_id"])
    op.create_index("ix_comprobantes_pago_orden_estado", "comprobantes_pago_orden", ["estado"])


def downgrade() -> None:
    op.drop_table("comprobantes_pago_orden")
