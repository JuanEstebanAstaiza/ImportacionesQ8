"""Pago manual de cursos (mientras no hay pasarela).

1. `comprobantes_pago.curso_id`: el curso que paga un comprobante de tipo `curso`.
2. `compras_curso`: de dónde salió el acceso (`origen`: inscripción, comprobante
   aprobado o acceso manual), quién lo dio, el comprobante y una nota.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261013_0038"
down_revision: Union[str, None] = "20261012_0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def _indices(tabla: str) -> set:
    return {i["name"] for i in sa.inspect(op.get_bind()).get_indexes(tabla)}


def upgrade() -> None:
    if "curso_id" not in _columnas("comprobantes_pago"):
        op.add_column("comprobantes_pago", sa.Column("curso_id", sa.String(length=36), nullable=True))
        op.create_foreign_key("fk_comprobantes_pago_curso", "comprobantes_pago", "cursos", ["curso_id"], ["id"])
    if "ix_comprobantes_pago_curso_id" not in _indices("comprobantes_pago"):
        op.create_index("ix_comprobantes_pago_curso_id", "comprobantes_pago", ["curso_id"])

    existentes = _columnas("compras_curso")
    if "origen" not in existentes:
        op.add_column("compras_curso", sa.Column("origen", sa.String(length=20), nullable=False,
                                                 server_default="inscripcion"))
    if "otorgado_por" not in existentes:
        op.add_column("compras_curso", sa.Column("otorgado_por", sa.String(length=36), nullable=True))
        op.create_foreign_key("fk_compras_curso_otorgado_por", "compras_curso", "usuarios", ["otorgado_por"], ["id"])
    if "comprobante_id" not in existentes:
        op.add_column("compras_curso", sa.Column("comprobante_id", sa.String(length=36), nullable=True))
    if "nota" not in existentes:
        op.add_column("compras_curso", sa.Column("nota", sa.String(length=300), nullable=True))


def downgrade() -> None:
    existentes = _columnas("compras_curso")
    if "otorgado_por" in existentes:
        op.drop_constraint("fk_compras_curso_otorgado_por", "compras_curso", type_="foreignkey")
    for columna in ("nota", "comprobante_id", "otorgado_por", "origen"):
        if columna in existentes:
            op.drop_column("compras_curso", columna)
    if "curso_id" in _columnas("comprobantes_pago"):
        if "ix_comprobantes_pago_curso_id" in _indices("comprobantes_pago"):
            op.drop_index("ix_comprobantes_pago_curso_id", table_name="comprobantes_pago")
        op.drop_constraint("fk_comprobantes_pago_curso", "comprobantes_pago", type_="foreignkey")
        op.drop_column("comprobantes_pago", "curso_id")
