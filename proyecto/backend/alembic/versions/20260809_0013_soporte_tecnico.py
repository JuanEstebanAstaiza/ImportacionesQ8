"""Tickets de soporte técnico y marcas de lectura.

Dos cosas que faltaban para que el equipo de la plataforma pueda atender:

- Un canal de soporte. Antes solo existían los hilos entre cliente y empresa; no
  había forma de que un usuario pidiera ayuda, y la pantalla de chats del
  administrador mostraba lo mismo que la de cualquiera. Se reutiliza la tabla de
  conversaciones (`tipo='soporte'`) para no duplicar mensajería, adjuntos y
  WebSocket; como un ticket no tiene lado empresa, `importador_usuario_id` pasa
  a admitir NULL.

- Marcas de lectura. El contador de no leídos estaba escrito a cero en la
  interfaz, así que ese filtro no podía funcionar. Se guarda hasta cuándo ha
  leído cada participante en cada hilo.

Revision ID: 20260809_0013
Revises: 20260809_0012
Create Date: 2026-08-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260809_0013"
down_revision: Union[str, None] = "20260809_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "conversaciones_chat"
TABLA_LECTURAS = "lecturas_conversacion"


def _inspector():
    return sa.inspect(op.get_bind())


def _columnas() -> dict:
    return {c["name"]: c for c in _inspector().get_columns(TABLA)}


def upgrade() -> None:
    columnas = _columnas()

    if "asunto" not in columnas:
        op.add_column(TABLA, sa.Column("asunto", sa.String(length=160), nullable=True))

    if "urgencia" not in columnas:
        op.add_column(TABLA, sa.Column("urgencia", sa.String(length=20), nullable=True))

    # Un ticket de soporte no tiene usuario de empresa al otro lado.
    if columnas.get("importador_usuario_id", {}).get("nullable") is False:
        op.alter_column(
            TABLA,
            "importador_usuario_id",
            existing_type=sa.String(length=36),
            nullable=True,
        )

    if TABLA_LECTURAS not in _inspector().get_table_names():
        op.create_table(
            TABLA_LECTURAS,
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("conversacion_id", sa.String(length=36), nullable=False),
            sa.Column("usuario_id", sa.String(length=36), nullable=False),
            sa.Column("fecha_ultima_lectura", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["conversacion_id"], ["conversaciones_chat.id"]),
            sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
            sa.PrimaryKeyConstraint("id"),
            # Una sola marca por participante y conversación: dos filas para el
            # mismo par harían que el contador dependiera de cuál se leyera.
            sa.UniqueConstraint("conversacion_id", "usuario_id", name="unique_lectura_por_usuario"),
        )
        op.create_index(
            op.f("ix_lecturas_conversacion_usuario_id"), TABLA_LECTURAS, ["usuario_id"]
        )


def downgrade() -> None:
    if TABLA_LECTURAS in _inspector().get_table_names():
        op.drop_index(op.f("ix_lecturas_conversacion_usuario_id"), table_name=TABLA_LECTURAS)
        op.drop_table(TABLA_LECTURAS)

    columnas = _columnas()

    # Volver atrás con tickets vivos dejaría filas sin usuario de empresa en una
    # columna NOT NULL: se descartan primero.
    op.execute(sa.text(f"DELETE FROM {TABLA} WHERE tipo = 'soporte'"))

    if "urgencia" in columnas:
        op.drop_column(TABLA, "urgencia")
    if "asunto" in columnas:
        op.drop_column(TABLA, "asunto")

    op.alter_column(
        TABLA,
        "importador_usuario_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
