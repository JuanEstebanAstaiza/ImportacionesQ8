"""Mesa de soporte por niveles, asignación y calificación del servicio.

Tres cosas:

- `usuarios.nivel_soporte`: a qué nivel de la mesa pertenece un agente. Sin esto
  no hay forma de evitar que un caso difícil caiga en quien acaba de entrar.
- `conversaciones_chat.nivel` y `agente_asignado_id`: qué nivel requiere el
  ticket y quién lo atiende. La asignación se hace al abrirlo.
- Calificación del servicio: quien pidió la ayuda puntúa al agente una vez
  cerrado el ticket.

Revision ID: 20260809_0016
Revises: 20260809_0015
Create Date: 2026-08-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260809_0016"
down_revision: Union[str, None] = "20260809_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHATS = "conversaciones_chat"
USUARIOS = "usuarios"


def _columnas(tabla: str) -> dict:
    return {c["name"]: c for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def upgrade() -> None:
    if "nivel_soporte" not in _columnas(USUARIOS):
        op.add_column(USUARIOS, sa.Column("nivel_soporte", sa.Integer(), nullable=True))
        # Las cuentas de soporte que ya existan entran por el nivel 1: es el
        # supuesto prudente, subirlas es una decisión de quien administra.
        op.execute(sa.text(f"UPDATE {USUARIOS} SET nivel_soporte = 1 WHERE rol = 'soporte'"))

    columnas = _columnas(CHATS)

    if "nivel" not in columnas:
        op.add_column(CHATS, sa.Column("nivel", sa.Integer(), nullable=True))
    if "agente_asignado_id" not in columnas:
        op.add_column(CHATS, sa.Column("agente_asignado_id", sa.String(length=36), nullable=True))
        op.create_foreign_key(
            "fk_conversaciones_chat_agente", CHATS, USUARIOS, ["agente_asignado_id"], ["id"]
        )
    if "calificacion" not in columnas:
        op.add_column(CHATS, sa.Column("calificacion", sa.Integer(), nullable=True))
    if "comentario_calificacion" not in columnas:
        op.add_column(CHATS, sa.Column("comentario_calificacion", sa.Text(), nullable=True))
    if "fecha_calificacion" not in columnas:
        op.add_column(CHATS, sa.Column("fecha_calificacion", sa.DateTime(), nullable=True))


def downgrade() -> None:
    columnas = _columnas(CHATS)

    for nombre in ("fecha_calificacion", "comentario_calificacion", "calificacion", "nivel"):
        if nombre in columnas:
            op.drop_column(CHATS, nombre)

    if "agente_asignado_id" in columnas:
        try:
            op.drop_constraint("fk_conversaciones_chat_agente", CHATS, type_="foreignkey")
        except Exception:
            pass
        op.drop_column(CHATS, "agente_asignado_id")

    if "nivel_soporte" in _columnas(USUARIOS):
        op.drop_column(USUARIOS, "nivel_soporte")
