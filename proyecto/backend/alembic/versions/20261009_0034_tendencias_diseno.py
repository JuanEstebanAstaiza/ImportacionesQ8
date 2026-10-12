"""Tendencias: etapa de diseño y rol designer.

Flujo nuevo: el aprobador aprueba el video (nombre, categoría y textos) y el
producto pasa a `en_diseno`. Un designer de Zarpi le pone la portada y las
imágenes con la identidad de marca, y lo publica.

- `tendencias_items.estado`: `aprobado_sin_portada` pasa a `en_diseno`.
- `tendencias_items.imagenes`: imágenes extra de la ficha (JSON con rutas de
  gestión documental, máximo 8).
- `tendencias_items.disenado_por` / `disenado_en`: quién lo diseñó y cuándo.

El rol `designer` no necesita esquema: `usuarios.rol` es texto.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261009_0034"
down_revision: Union[str, None] = "20261009_0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    columnas = _columnas("tendencias_items")
    if "imagenes" not in columnas:
        op.add_column("tendencias_items", sa.Column("imagenes", sa.Text(), nullable=True))
    if "disenado_por" not in columnas:
        op.add_column("tendencias_items", sa.Column("disenado_por", sa.String(length=36), nullable=True))
    if "disenado_en" not in columnas:
        op.add_column("tendencias_items", sa.Column("disenado_en", sa.DateTime(), nullable=True))
    op.execute("UPDATE tendencias_items SET estado = 'en_diseno' WHERE estado = 'aprobado_sin_portada'")


def downgrade() -> None:
    op.execute("UPDATE tendencias_items SET estado = 'aprobado_sin_portada' WHERE estado = 'en_diseno'")
    columnas = _columnas("tendencias_items")
    for nombre in ("disenado_en", "disenado_por", "imagenes"):
        if nombre in columnas:
            op.drop_column("tendencias_items", nombre)
