"""Canal interno empresa ↔ asesor sobre la tabla de conversaciones existente.

Hasta ahora `conversaciones_chat` solo modelaba el hilo solicitante ↔ empresa.
La empresa necesita además coordinar a sus asesores (cuándo mover el estado de
una orden), y ese hilo no puede ser legible por el cliente.

Se reutiliza la misma tabla en vez de crear una paralela para no duplicar toda
la mensajería que ya cuelga de ella (mensajes, adjuntos, traducción, WebSocket).
La forma se distingue por `tipo`; las columnas que no aplican van en nulo, por
eso `cotizacion_id` y `solicitante_id` pasan a admitir NULL.

Revision ID: 20260809_0012
Revises: 20260808_0011
Create Date: 2026-08-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260809_0012"
down_revision: Union[str, None] = "20260808_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "conversaciones_chat"


def _columnas() -> dict:
    return {c["name"]: c for c in sa.inspect(op.get_bind()).get_columns(TABLA)}


def _restricciones_unicas() -> set:
    inspector = sa.inspect(op.get_bind())
    return {c["name"] for c in inspector.get_unique_constraints(TABLA)}


def upgrade() -> None:
    # La revisión inicial hace `create_all` de los modelos actuales, así que en
    # una base recién creada esto ya está aplicado.
    columnas = _columnas()

    if "tipo" not in columnas:
        op.add_column(
            TABLA,
            sa.Column(
                "tipo",
                sa.String(length=20),
                nullable=False,
                # Las filas que ya existen son todas de negociación.
                server_default="negociacion",
            ),
        )

    if "importador_id" not in columnas:
        op.add_column(TABLA, sa.Column("importador_id", sa.String(length=36), nullable=True))
        op.create_foreign_key(
            "fk_conversaciones_chat_importador",
            TABLA,
            "importadores",
            ["importador_id"],
            ["id"],
        )

    # Las conversaciones internas no cuelgan de ninguna cotización ni tienen
    # solicitante, así que ambas columnas dejan de ser obligatorias.
    if columnas.get("cotizacion_id", {}).get("nullable") is False:
        op.alter_column(
            TABLA,
            "cotizacion_id",
            existing_type=sa.String(length=36),
            nullable=True,
        )

    if columnas.get("solicitante_id", {}).get("nullable") is False:
        op.alter_column(
            TABLA,
            "solicitante_id",
            existing_type=sa.String(length=36),
            nullable=True,
        )

    if "unique_conversacion_interna" not in _restricciones_unicas():
        op.create_unique_constraint(
            "unique_conversacion_interna",
            TABLA,
            ["importador_id", "importador_usuario_id"],
        )


def downgrade() -> None:
    columnas = _columnas()

    if "unique_conversacion_interna" in _restricciones_unicas():
        op.drop_constraint("unique_conversacion_interna", TABLA, type_="unique")

    # Volver atrás con hilos internos vivos dejaría filas sin cotización en una
    # columna NOT NULL: se descartan primero.
    if "tipo" in columnas:
        op.execute(sa.text(f"DELETE FROM {TABLA} WHERE tipo = 'interna'"))

    if "importador_id" in columnas:
        try:
            op.drop_constraint("fk_conversaciones_chat_importador", TABLA, type_="foreignkey")
        except Exception:
            pass
        op.drop_column(TABLA, "importador_id")

    if "tipo" in columnas:
        op.drop_column(TABLA, "tipo")

    op.alter_column(TABLA, "cotizacion_id", existing_type=sa.String(length=36), nullable=False)
    op.alter_column(TABLA, "solicitante_id", existing_type=sa.String(length=36), nullable=False)
