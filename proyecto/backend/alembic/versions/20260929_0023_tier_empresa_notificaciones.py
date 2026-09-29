"""Tier mínimo por empresa, referencias en notificaciones e importaciones externas.

- `importadores.tier_minimo_requerido`: pasa de vivir en el JSON
  `perfil_publico` a ser columna, para que el servidor lo haga cumplir. Se
  rellena con lo que cada empresa ya había guardado en el JSON.
- `notificaciones.cotizacion_id` / `conversacion_id`: deep-link indexable.
- `usuarios.importaciones_fuera_plataforma`: desglose del perfil público.
- `cotizaciones.tier_solicitante_creacion`: el bloqueo se evalúa contra el tier
  que tenía el cotizante al crearla, no contra el actual.
"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260929_0023"
down_revision: Union[str, None] = "20260921_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TIERS_VALIDOS = ("Bronze", "Silver", "Gold", "Élite")


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def _indices(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {indice["name"] for indice in inspector.get_indexes(tabla)}


def _rellenar_tier_empresas() -> None:
    bind = op.get_bind()
    filas = bind.execute(sa.text("SELECT id, perfil_publico FROM importadores")).fetchall()
    for importador_id, perfil in filas:
        if isinstance(perfil, str):
            try:
                perfil = json.loads(perfil)
            except ValueError:
                perfil = None
        tier = perfil.get("tier_minimo_requerido") if isinstance(perfil, dict) else None
        if tier in TIERS_VALIDOS and tier != "Bronze":
            bind.execute(
                sa.text("UPDATE importadores SET tier_minimo_requerido = :tier WHERE id = :id"),
                {"tier": tier, "id": importador_id},
            )


def upgrade() -> None:
    if "tier_minimo_requerido" not in _columnas("importadores"):
        op.add_column(
            "importadores",
            sa.Column("tier_minimo_requerido", sa.String(length=10), nullable=False, server_default="Bronze"),
        )
        _rellenar_tier_empresas()

    notificaciones = _columnas("notificaciones")
    if "cotizacion_id" not in notificaciones:
        op.add_column("notificaciones", sa.Column("cotizacion_id", sa.String(length=36), nullable=True))
    if "conversacion_id" not in notificaciones:
        op.add_column("notificaciones", sa.Column("conversacion_id", sa.String(length=36), nullable=True))
    indices = _indices("notificaciones")
    if "ix_notificaciones_cotizacion_id" not in indices:
        op.create_index("ix_notificaciones_cotizacion_id", "notificaciones", ["cotizacion_id"])
    if "ix_notificaciones_conversacion_id" not in indices:
        op.create_index("ix_notificaciones_conversacion_id", "notificaciones", ["conversacion_id"])

    if "importaciones_fuera_plataforma" not in _columnas("usuarios"):
        op.add_column(
            "usuarios",
            sa.Column("importaciones_fuera_plataforma", sa.Integer(), nullable=False, server_default="0"),
        )

    if "tier_solicitante_creacion" not in _columnas("cotizaciones"):
        op.add_column("cotizaciones", sa.Column("tier_solicitante_creacion", sa.String(length=10), nullable=True))


def downgrade() -> None:
    if "tier_solicitante_creacion" in _columnas("cotizaciones"):
        op.drop_column("cotizaciones", "tier_solicitante_creacion")

    if "importaciones_fuera_plataforma" in _columnas("usuarios"):
        op.drop_column("usuarios", "importaciones_fuera_plataforma")

    indices = _indices("notificaciones")
    if "ix_notificaciones_conversacion_id" in indices:
        op.drop_index("ix_notificaciones_conversacion_id", table_name="notificaciones")
    if "ix_notificaciones_cotizacion_id" in indices:
        op.drop_index("ix_notificaciones_cotizacion_id", table_name="notificaciones")
    notificaciones = _columnas("notificaciones")
    if "conversacion_id" in notificaciones:
        op.drop_column("notificaciones", "conversacion_id")
    if "cotizacion_id" in notificaciones:
        op.drop_column("notificaciones", "cotizacion_id")

    if "tier_minimo_requerido" in _columnas("importadores"):
        op.drop_column("importadores", "tier_minimo_requerido")
