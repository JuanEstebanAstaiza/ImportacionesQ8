"""Reto: monto pagado por recompensa.

`reto_participaciones.monto_pagado_cop` guarda cuánto se transfirió de verdad.
Antes el total pagado se calculaba con la recompensa vigente de la ronda; ahora
que el admin puede cambiar la recompensa, lo ya pagado no debe moverse.
Las filas pagadas antes de esta migración toman la recompensa de su ronda.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_0031"
down_revision: Union[str, None] = "20261008_0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    if "monto_pagado_cop" not in _columnas("reto_participaciones"):
        op.add_column("reto_participaciones", sa.Column("monto_pagado_cop", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE reto_participaciones SET monto_pagado_cop = "
        "(SELECT recompensa_cop FROM reto_rondas WHERE reto_rondas.id = reto_participaciones.ronda_id) "
        "WHERE estado_recompensa = 'pagada' AND eleccion = 'efectivo' AND monto_pagado_cop IS NULL"
    )


def downgrade() -> None:
    if "monto_pagado_cop" in _columnas("reto_participaciones"):
        op.drop_column("reto_participaciones", "monto_pagado_cop")
