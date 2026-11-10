"""Modalidad de acceso del curso: de pago, gratis o primer módulo gratis.

Antes un curso gratis era uno con precio 0, y en el catálogo aparecía «$0».
Ahora el autor elige la modalidad: «gratis» (sin precio), «pago» o
«primer_modulo_gratis» (el primer módulo se ve sin pagar y al terminarlo se
le pide comprar para seguir). Los cursos existentes con precio 0 quedan como
gratis; el resto, de pago.

Revision ID: 20261109_0046
Revises: 20261024_0045
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261109_0046"
down_revision: Union[str, None] = "20261024_0045"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columnas = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("cursos")}
    if "modalidad" not in columnas:
        op.add_column("cursos", sa.Column("modalidad", sa.String(length=30), nullable=False, server_default="pago"))
        op.execute("UPDATE cursos SET modalidad = 'gratis' WHERE precio IS NULL OR precio <= 0")


def downgrade() -> None:
    op.drop_column("cursos", "modalidad")
