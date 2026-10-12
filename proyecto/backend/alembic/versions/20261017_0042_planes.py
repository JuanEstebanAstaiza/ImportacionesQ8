"""Planes de acceso con pago manual.

1. `planes`: lo que se publica en la sección «Planes» del home (precio sin
   IVA, solicitudes, vigencia, Tendencias, precio de adicionales, cupos).
   Se siembran el Paquete Importador y el Plan VIP del copy v1 si no hay
   ninguno; después se editan en Admin › Planes.
2. `inscripciones_plan`: cada compra (datos, comprobante y revisión).
3. `usuarios.plan_id`, `plan_vence_en`, `solicitudes_plan`: el saldo del plan.
4. `cotizaciones.unidad_cobrada`, `unidad_devuelta_en`: qué unidad se gastó y
   si se devolvió por no recibir propuestas en 72 horas.
"""
import json
from datetime import datetime
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20261017_0042"
down_revision: Union[str, None] = "20261016_0041"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tablas() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


PLANES_INICIALES = [
    {
        "clave": "importador", "nombre": "Paquete Importador", "para_quien": "Para quien ya sabe qué quiere traer.",
        "precio_cop": 500000, "solicitudes_incluidas": 10, "vigencia_meses": 12, "dias_tendencias": None,
        "precio_solicitud_adicional_cop": None, "destacado": False, "orden": 1,
        "incluye": [
            "10 solicitudes de cotización",
            "Vigencia de 12 meses",
            "Propuestas de empresas importadoras verificadas, con precio final en Colombia",
            "Chat, documentos y seguimiento de cada operación",
        ],
    },
    {
        "clave": "vip", "nombre": "Plan VIP", "para_quien": "Para quien quiere importar con acompañamiento.",
        "precio_cop": 2000000, "solicitudes_incluidas": 10, "vigencia_meses": 12, "dias_tendencias": 180,
        "precio_solicitud_adicional_cop": 25000, "destacado": True, "orden": 2,
        "incluye": [
            "10 solicitudes de cotización incluidas; adicionales a $25.000 + IVA",
            "Vigencia de 12 meses",
            "Módulo de Tendencias durante 6 meses: productos que se están moviendo, listos para cotizar",
            "Sesión 1:1 con Juan Pablo Orozco para resolver tus dudas de importación",
            "Sesiones de formación en vivo: costeos, modalidades y casos reales",
            "Todo lo del Paquete Importador",
        ],
    },
]


def upgrade() -> None:
    tablas = _tablas()
    if "planes" not in tablas:
        op.create_table(
            "planes",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("clave", sa.String(length=40), nullable=False),
            sa.Column("nombre", sa.String(length=80), nullable=False),
            sa.Column("para_quien", sa.String(length=200), nullable=True),
            sa.Column("precio_cop", sa.Integer(), nullable=False),
            sa.Column("iva_pct", sa.Integer(), nullable=False, server_default="19"),
            sa.Column("solicitudes_incluidas", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("vigencia_meses", sa.Integer(), nullable=False, server_default="12"),
            sa.Column("dias_tendencias", sa.Integer(), nullable=True),
            sa.Column("precio_solicitud_adicional_cop", sa.Integer(), nullable=True),
            sa.Column("incluye", sa.JSON(), nullable=True),
            sa.Column("cupos_totales", sa.Integer(), nullable=True),
            sa.Column("destacado", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("clave", name="uq_planes_clave"),
        )
    if "inscripciones_plan" not in tablas:
        op.create_table(
            "inscripciones_plan",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("plan_id", sa.String(length=36), sa.ForeignKey("planes.id"), nullable=False),
            sa.Column("estado", sa.String(length=20), nullable=False),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("tipo_persona", sa.String(length=10), nullable=False),
            sa.Column("nombre", sa.String(length=120), nullable=True),
            sa.Column("apellido", sa.String(length=120), nullable=True),
            sa.Column("tipo_documento", sa.String(length=30), nullable=True),
            sa.Column("numero_documento", sa.String(length=50), nullable=True),
            sa.Column("razon_social", sa.String(length=255), nullable=True),
            sa.Column("nit", sa.String(length=50), nullable=True),
            sa.Column("indicativo_pais_telefono", sa.String(length=6), nullable=False),
            sa.Column("telefono", sa.String(length=30), nullable=False),
            sa.Column("ciudad", sa.String(length=100), nullable=True),
            sa.Column("precio_cop", sa.Integer(), nullable=True),
            sa.Column("iva_cop", sa.Integer(), nullable=True),
            sa.Column("total_cop", sa.Integer(), nullable=True),
            sa.Column("comprobante_ruta", sa.String(length=500), nullable=True),
            sa.Column("comprobante_nombre", sa.String(length=255), nullable=True),
            sa.Column("comprobante_mime", sa.String(length=120), nullable=True),
            sa.Column("acepto_condiciones", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("acepto_datos", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("fecha_aceptacion", sa.DateTime(), nullable=True),
            sa.Column("motivo_rechazo", sa.Text(), nullable=True),
            sa.Column("revisado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("revisado_en", sa.DateTime(), nullable=True),
            sa.Column("vence_en", sa.DateTime(), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_inscripciones_plan_plan_id", "inscripciones_plan", ["plan_id"])
        op.create_index("ix_inscripciones_plan_estado", "inscripciones_plan", ["estado"])
        op.create_index("ix_inscripciones_plan_usuario_id", "inscripciones_plan", ["usuario_id"])
        op.create_index("ix_inscripciones_plan_email", "inscripciones_plan", ["email"])

    columnas = _columnas("usuarios")
    if "plan_id" not in columnas:
        op.add_column("usuarios", sa.Column("plan_id", sa.String(length=36), nullable=True))
        op.create_foreign_key("fk_usuarios_plan", "usuarios", "planes", ["plan_id"], ["id"])
    if "plan_vence_en" not in columnas:
        op.add_column("usuarios", sa.Column("plan_vence_en", sa.DateTime(), nullable=True))
    if "solicitudes_plan" not in columnas:
        op.add_column("usuarios", sa.Column("solicitudes_plan", sa.Integer(), nullable=False, server_default="0"))

    columnas = _columnas("cotizaciones")
    if "unidad_cobrada" not in columnas:
        op.add_column("cotizaciones", sa.Column("unidad_cobrada", sa.String(length=10), nullable=True))
    if "unidad_devuelta_en" not in columnas:
        op.add_column("cotizaciones", sa.Column("unidad_devuelta_en", sa.DateTime(), nullable=True))

    bind = op.get_bind()
    if not bind.execute(sa.text("SELECT COUNT(*) FROM planes")).scalar():
        tabla = sa.table(
            "planes", sa.column("id"), sa.column("clave"), sa.column("nombre"), sa.column("para_quien"),
            sa.column("precio_cop"), sa.column("iva_pct"), sa.column("solicitudes_incluidas"),
            sa.column("vigencia_meses"), sa.column("dias_tendencias"), sa.column("precio_solicitud_adicional_cop"),
            sa.column("incluye", sa.JSON()), sa.column("cupos_totales"), sa.column("destacado"), sa.column("orden"),
            sa.column("activo"), sa.column("fecha_creacion"),
        )
        op.bulk_insert(tabla, [
            {**p, "id": str(uuid4()), "iva_pct": 19, "cupos_totales": None, "activo": True,
             "fecha_creacion": datetime.utcnow()}
            for p in json.loads(json.dumps(PLANES_INICIALES))
        ])


def downgrade() -> None:
    columnas = _columnas("cotizaciones")
    for col in ("unidad_devuelta_en", "unidad_cobrada"):
        if col in columnas:
            op.drop_column("cotizaciones", col)
    columnas = _columnas("usuarios")
    if "plan_id" in columnas:
        op.drop_constraint("fk_usuarios_plan", "usuarios", type_="foreignkey")
        op.drop_column("usuarios", "plan_id")
    for col in ("plan_vence_en", "solicitudes_plan"):
        if col in columnas:
            op.drop_column("usuarios", col)
    tablas = _tablas()
    if "inscripciones_plan" in tablas:
        op.drop_table("inscripciones_plan")
    if "planes" in tablas:
        op.drop_table("planes")
