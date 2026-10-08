"""Reto: los datos bancarios ya no se guardan de forma permanente.

Se piden al reclamar la recompensa en efectivo y se borran al marcar el pago.
Del pago queda solo lo necesario para el comprobante, en la participación:
banco, tipo de cuenta y últimos 4 dígitos (`pago_banco`, `pago_tipo_cuenta`,
`pago_ultimos_digitos`).

Esta migración completa esos campos en los pagos ya hechos y borra las
cuentas que no tienen un pago en camino.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_0032"
down_revision: Union[str, None] = "20261009_0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNAS = (
    ("pago_banco", sa.String(length=80)),
    ("pago_tipo_cuenta", sa.String(length=20)),
    ("pago_ultimos_digitos", sa.String(length=4)),
)


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    existentes = _columnas("reto_participaciones")
    for nombre, tipo in COLUMNAS:
        if nombre not in existentes:
            op.add_column("reto_participaciones", sa.Column(nombre, tipo, nullable=True))

    for destino, origen in (("pago_banco", "banco"), ("pago_tipo_cuenta", "tipo_cuenta"),
                            ("pago_ultimos_digitos", "ultimos_digitos")):
        op.execute(
            f"UPDATE reto_participaciones SET {destino} = "
            f"(SELECT {origen} FROM cuentas_pago WHERE cuentas_pago.usuario_id = reto_participaciones.usuario_id) "
            f"WHERE estado_recompensa = 'pagada' AND eleccion = 'efectivo' AND {destino} IS NULL"
        )
    op.execute(
        "DELETE FROM cuentas_pago WHERE usuario_id NOT IN ("
        "SELECT usuario_id FROM reto_participaciones "
        "WHERE estado_recompensa = 'solicitada' AND eleccion = 'efectivo')"
    )


def downgrade() -> None:
    existentes = _columnas("reto_participaciones")
    for nombre, _ in COLUMNAS:
        if nombre in existentes:
            op.drop_column("reto_participaciones", nombre)
