"""Categorías de cotizante (lista privada).

1. `categorias_cotizante`: nombre, tier y días de Tendencias que se le aplican
   a un cotizante al asignársela.
2. `usuarios.categoria_id`: la categoría que tiene cada cotizante.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261016_0041"
down_revision: Union[str, None] = "20261015_0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tablas() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    if "categorias_cotizante" not in _tablas():
        op.create_table(
            "categorias_cotizante",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("nombre", sa.String(length=60), nullable=False),
            sa.Column("descripcion", sa.String(length=300), nullable=True),
            sa.Column("tier", sa.String(length=10), nullable=True),
            sa.Column("dias_tendencias", sa.Integer(), nullable=True),
            sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("creado_por", sa.String(length=36), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("nombre", name="uq_categorias_cotizante_nombre"),
        )
    if "categoria_id" not in _columnas("usuarios"):
        op.add_column("usuarios", sa.Column("categoria_id", sa.String(length=36), nullable=True))
        op.create_foreign_key("fk_usuarios_categoria_cotizante", "usuarios", "categorias_cotizante",
                              ["categoria_id"], ["id"])


def downgrade() -> None:
    if "categoria_id" in _columnas("usuarios"):
        op.drop_constraint("fk_usuarios_categoria_cotizante", "usuarios", type_="foreignkey")
        op.drop_column("usuarios", "categoria_id")
    if "categorias_cotizante" in _tablas():
        op.drop_table("categorias_cotizante")
