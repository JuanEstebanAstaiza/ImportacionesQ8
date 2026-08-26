"""Precisión de microsegundos en las marcas de tiempo del chat.

El contador de no leídos compara `mensajes_chat.fecha_envio` con
`lecturas_conversacion.fecha_ultima_lectura`. MySQL trunca DATETIME a segundos
enteros si no se le pide precisión, así que un mensaje que llegaba en el mismo
segundo en que alguien abría el hilo quedaba "no posterior" a la lectura y
desaparecía del contador para siempre.

SQLite sí guarda microsegundos, por lo que el fallo no se reproduce en los
tests y solo aparece contra la base real.

Revision ID: 20260809_0014
Revises: 20260809_0013
Create Date: 2026-08-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "20260809_0014"
down_revision: Union[str, None] = "20260809_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (tabla, columna, admite NULL)
COLUMNAS = [
    ("mensajes_chat", "fecha_envio", True),
    ("lecturas_conversacion", "fecha_ultima_lectura", False),
]


def upgrade() -> None:
    # Solo MySQL necesita el cambio: SQLite ya guarda la fracción de segundo.
    if op.get_bind().dialect.name != "mysql":
        return

    for tabla, columna, nullable in COLUMNAS:
        op.alter_column(
            tabla,
            columna,
            existing_type=mysql.DATETIME(),
            type_=mysql.DATETIME(fsp=6),
            existing_nullable=nullable,
        )


def downgrade() -> None:
    if op.get_bind().dialect.name != "mysql":
        return

    for tabla, columna, nullable in COLUMNAS:
        op.alter_column(
            tabla,
            columna,
            existing_type=mysql.DATETIME(fsp=6),
            type_=mysql.DATETIME(),
            existing_nullable=nullable,
        )
