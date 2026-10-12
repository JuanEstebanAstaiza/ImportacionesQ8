"""Repone `articulos_ayuda` en las bases que arrancaron sin ella.

Una BD vacía se crea con `create_all` desde `import models` y se marca en head
(`database.bootstrap_si_vacia`). `models/__init__.py` no importaba el modelo de
ayuda, así que esa tabla no se creaba, y como la BD ya estaba en head la 0017
nunca corría: `/ayuda/articulos` respondía 500 («Table … doesn't exist»).

Es la misma tabla de la 0017; si ya existe, no hace nada. El contenido inicial
se carga con `scripts/seed_ayuda.py` (idempotente).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261015_0040"
down_revision: Union[str, None] = "20261014_0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "articulos_ayuda"


def upgrade() -> None:
    if TABLA in sa.inspect(op.get_bind()).get_table_names():
        return

    op.create_table(
        TABLA,
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("resumen", sa.String(length=400), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=True),
        sa.Column("categoria", sa.String(length=60), nullable=False),
        sa.Column("roles", sa.JSON(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("publicado", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("vistas", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("votos_util", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("votos_inutil", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("autor_id", sa.String(length=36), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=True),
        sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["autor_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_articulos_ayuda_categoria"), TABLA, ["categoria"])


def downgrade() -> None:
    # La tabla es de la 0017: bajar de esta revisión no la borra.
    pass
