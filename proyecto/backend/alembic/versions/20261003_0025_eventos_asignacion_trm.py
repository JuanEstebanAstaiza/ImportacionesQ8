"""Bitácora de eventos, asignación de solicitudes y TRM.

- `eventos`: cada cambio de estado del negocio con su fecha y hora, montos
  (USD y COP con la TRM del momento) y cantidad con unidad.
- `configuracion_plataforma`: ajustes que el admin cambia sin desplegar (modo y
  cupo de asignación, TRM de respaldo y la última oficial).
- `cotizaciones.unidad_cantidad` ("unidades" o "m3"), `cantidad_minima` pasa a
  decimal, y `motivo_eleccion(_detalle)`: por qué el cliente eligió una propuesta.
- `propuestas.cantidad` y el motivo y la fecha de descarte.
- `recepciones_cotizacion.origen` / `asignado_por`: cómo llegó la solicitud.
- `importadores.pedido_minimo(_unidad)`: criterio de encaje para asignar.

La bitácora se rellena con lo que ya se puede reconstruir de los datos: la
creación de cada solicitud, a quién se entregó, las propuestas enviadas, las
aceptadas y descartadas, y los cambios de estado de cada pedido. Esas filas
llevan `datos.origen = "historico"` y no tienen TRM: la del día en que pasaron
no se guardó, y las métricas las convierten con la vigente.
"""
from datetime import datetime
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "20261003_0025"
down_revision: Union[str, None] = "20260930_0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FECHA_EVENTO = sa.DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql")

ETAPA_POR_ESTADO_ORDEN = {
    "cotizacion_aceptada": "compra",
    "en_produccion": "embarque",
    "transito_internacional": "transito",
    "aduana_nacionalizacion": "nacionalizacion",
    "bodega_local": "entrega",
    "entregado": "entregado",
}


def _columnas(tabla: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def _tablas() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _agregar(tabla: str, columna: sa.Column) -> None:
    if columna.name not in _columnas(tabla):
        op.add_column(tabla, columna)


def upgrade() -> None:
    if "configuracion_plataforma" not in _tablas():
        op.create_table(
            "configuracion_plataforma",
            sa.Column("clave", sa.String(length=80), primary_key=True),
            sa.Column("valor", sa.Text(), nullable=True),
            sa.Column("actualizado_por", sa.String(length=36), nullable=True),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        )

    _agregar("cotizaciones", sa.Column("unidad_cantidad", sa.String(length=10), nullable=False, server_default="unidades"))
    _agregar("cotizaciones", sa.Column("motivo_eleccion", sa.String(length=20), nullable=True))
    _agregar("cotizaciones", sa.Column("motivo_eleccion_detalle", sa.Text(), nullable=True))
    _agregar("propuestas", sa.Column("cantidad", sa.Float(), nullable=True))
    _agregar("propuestas", sa.Column("motivo_descarte", sa.String(length=20), nullable=True))
    _agregar("propuestas", sa.Column("motivo_descarte_detalle", sa.Text(), nullable=True))
    _agregar("propuestas", sa.Column("fecha_descarte", sa.DateTime(), nullable=True))
    _agregar("recepciones_cotizacion", sa.Column("origen", sa.String(length=20), nullable=True))
    _agregar("importadores", sa.Column("pedido_minimo", sa.Float(), nullable=True))
    _agregar("importadores", sa.Column("pedido_minimo_unidad", sa.String(length=10), nullable=True))
    _agregar("recepciones_cotizacion", sa.Column("asignado_por", sa.String(length=36), nullable=True))

    if op.get_bind().dialect.name == "mysql":
        # Los m³ se piden con decimales; las unidades siguen siendo enteras.
        op.alter_column(
            "cotizaciones", "cantidad_minima",
            existing_type=sa.Integer(), type_=sa.Float(), existing_nullable=False,
        )

    op.execute(
        "UPDATE recepciones_cotizacion SET origen = "
        "CASE WHEN modalidad = 'dirigida' THEN 'dirigida' ELSE 'automatica' END "
        "WHERE origen IS NULL"
    )

    if "eventos" not in _tablas():
        eventos = op.create_table(
            "eventos",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("tipo", sa.String(length=40), nullable=False),
            sa.Column("fecha", FECHA_EVENTO, nullable=False),
            sa.Column("cotizacion_id", sa.String(length=36), nullable=True),
            sa.Column("propuesta_id", sa.String(length=36), nullable=True),
            sa.Column("orden_id", sa.String(length=36), nullable=True),
            sa.Column("importador_id", sa.String(length=36), nullable=True),
            sa.Column("usuario_id", sa.String(length=36), nullable=True),
            sa.Column("rol_usuario", sa.String(length=20), nullable=True),
            sa.Column("estado_anterior", sa.String(length=40), nullable=True),
            sa.Column("estado_nuevo", sa.String(length=40), nullable=True),
            sa.Column("motivo", sa.String(length=20), nullable=True),
            sa.Column("motivo_detalle", sa.Text(), nullable=True),
            sa.Column("monto", sa.Float(), nullable=True),
            sa.Column("moneda", sa.String(length=10), nullable=True),
            sa.Column("monto_usd", sa.Float(), nullable=True),
            sa.Column("trm", sa.Float(), nullable=True),
            sa.Column("monto_cop", sa.Float(), nullable=True),
            sa.Column("cantidad", sa.Float(), nullable=True),
            sa.Column("unidad", sa.String(length=20), nullable=True),
            sa.Column("datos", sa.JSON(), nullable=True),
        )
        op.create_index("ix_eventos_tipo_fecha", "eventos", ["tipo", "fecha"])
        op.create_index("ix_eventos_importador_fecha", "eventos", ["importador_id", "fecha"])
        op.create_index("ix_eventos_cotizacion", "eventos", ["cotizacion_id"])
        op.create_index("ix_eventos_orden", "eventos", ["orden_id"])
        _rellenar_historico(eventos)


def _rellenar_historico(eventos: sa.Table) -> None:
    conexion = op.get_bind()
    filas = []

    def evento(tipo, fecha, **campos):
        if fecha is None:
            return
        if isinstance(fecha, str):  # SQLite devuelve las fechas de un SELECT crudo como texto
            fecha = datetime.fromisoformat(fecha)
        datos = {"origen": "historico"}
        datos.update(campos.pop("datos", None) or {})
        monto_usd = campos.get("monto_usd")
        filas.append({
            "id": str(uuid4()),
            "tipo": tipo,
            "fecha": fecha,
            "cotizacion_id": campos.get("cotizacion_id"),
            "propuesta_id": campos.get("propuesta_id"),
            "orden_id": campos.get("orden_id"),
            "importador_id": campos.get("importador_id"),
            "usuario_id": campos.get("usuario_id"),
            "rol_usuario": campos.get("rol_usuario"),
            "estado_anterior": campos.get("estado_anterior"),
            "estado_nuevo": campos.get("estado_nuevo"),
            "motivo": None,
            "motivo_detalle": None,
            "monto": campos.get("monto", monto_usd),
            "moneda": campos.get("moneda", "USD" if monto_usd is not None else None),
            "monto_usd": monto_usd,
            "trm": None,
            "monto_cop": campos.get("monto_cop"),
            "cantidad": campos.get("cantidad"),
            "unidad": campos.get("unidad"),
            "datos": datos,
        })

    cotizaciones = {}
    for c in conexion.execute(sa.text(
        "SELECT id, solicitante_id, importador_id, modalidad, linea_producto, cantidad_minima, unidad_cantidad, "
        "precio_objetivo_usd, moneda_precio_objetivo, fecha_creacion FROM cotizaciones"
    )).mappings():
        cotizaciones[c["id"]] = c
        moneda = (c["moneda_precio_objetivo"] or "USD").upper()
        monto = c["precio_objetivo_usd"]
        evento(
            "solicitud_creada", c["fecha_creacion"],
            cotizacion_id=c["id"], usuario_id=c["solicitante_id"], rol_usuario="solicitante",
            monto=monto, moneda=moneda if monto is not None else None,
            monto_usd=monto if moneda == "USD" else None,
            monto_cop=monto if moneda == "COP" else None,
            cantidad=c["cantidad_minima"], unidad=c["unidad_cantidad"] or "unidades",
            datos={"modalidad": c["modalidad"], "linea_producto": c["linea_producto"]},
        )

    def cantidad_de(cotizacion_id):
        c = cotizaciones.get(cotizacion_id)
        return (c["cantidad_minima"], c["unidad_cantidad"] or "unidades") if c else (None, None)

    asignadas = set()

    def asignada(importador_id, cotizacion_id, fecha, modalidad, origen):
        if not importador_id or (importador_id, cotizacion_id) in asignadas:
            return
        asignadas.add((importador_id, cotizacion_id))
        cantidad, unidad = cantidad_de(cotizacion_id)
        evento(
            "solicitud_asignada", fecha,
            cotizacion_id=cotizacion_id, importador_id=importador_id,
            cantidad=cantidad, unidad=unidad,
            datos={"modalidad": modalidad, "origen_asignacion": origen},
        )

    for r in conexion.execute(sa.text(
        "SELECT importador_id, cotizacion_id, modalidad, origen, fecha_recepcion "
        "FROM recepciones_cotizacion WHERE entregada = :si"
    ), {"si": True}).mappings():
        asignadas.add((r["importador_id"], r["cotizacion_id"]))
        cantidad, unidad = cantidad_de(r["cotizacion_id"])
        evento(
            "solicitud_asignada", r["fecha_recepcion"],
            cotizacion_id=r["cotizacion_id"], importador_id=r["importador_id"],
            cantidad=cantidad, unidad=unidad,
            datos={"modalidad": r["modalidad"], "origen_asignacion": r["origen"]},
        )

    # Antes de `recepciones_cotizacion` (migración 0024) no quedaba constancia
    # del reparto: la dirigida llegó a su empresa al crearse, y una empresa que
    # respondió una abierta la había recibido en el matching de su creación.
    for c in cotizaciones.values():
        if c["modalidad"] == "dirigida":
            asignada(c["importador_id"], c["id"], c["fecha_creacion"], "dirigida", "dirigida")
    for p in conexion.execute(sa.text(
        "SELECT cotizacion_id, importador_id FROM propuestas WHERE estado <> 'borrador'"
    )).mappings():
        c = cotizaciones.get(p["cotizacion_id"])
        if c is not None:
            origen = "dirigida" if c["modalidad"] == "dirigida" else "automatica"
            asignada(p["importador_id"], c["id"], c["fecha_creacion"], c["modalidad"], origen)

    ordenes = {o["cotizacion_id"]: o for o in conexion.execute(sa.text(
        "SELECT id, cotizacion_id, importador_id, precio_acordado_usd, fecha_creacion FROM ordenes"
    )).mappings()}

    for p in conexion.execute(sa.text(
        "SELECT id, cotizacion_id, importador_id, precio_ofrecido_usd, tiempo_estimado_entrega, "
        "incoterm, estado, fecha_envio, creado_por_usuario_id FROM propuestas WHERE estado <> 'borrador'"
    )).mappings():
        cantidad, unidad = cantidad_de(p["cotizacion_id"])
        base = dict(
            cotizacion_id=p["cotizacion_id"], propuesta_id=p["id"], importador_id=p["importador_id"],
            monto_usd=p["precio_ofrecido_usd"], cantidad=cantidad, unidad=unidad,
            datos={"tiempo_estimado_entrega": p["tiempo_estimado_entrega"], "incoterm": p["incoterm"]},
        )
        evento("propuesta_enviada", p["fecha_envio"], usuario_id=p["creado_por_usuario_id"], **base)
        orden = ordenes.get(p["cotizacion_id"])
        cierre = orden["fecha_creacion"] if orden else None
        if p["estado"] == "aceptada":
            evento("propuesta_aceptada", cierre, orden_id=orden["id"] if orden else None, **base)
        elif p["estado"] == "rechazada":
            evento("propuesta_descartada", cierre, **base)

    for h in conexion.execute(sa.text(
        "SELECT h.orden_id, h.estado_anterior, h.estado_nuevo, h.fecha_cambio, "
        "o.cotizacion_id, o.importador_id, o.precio_acordado_usd "
        "FROM historial_estados_orden h JOIN ordenes o ON o.id = h.orden_id"
    )).mappings():
        cantidad, unidad = cantidad_de(h["cotizacion_id"])
        evento(
            "pedido_hito", h["fecha_cambio"],
            cotizacion_id=h["cotizacion_id"], orden_id=h["orden_id"], importador_id=h["importador_id"],
            estado_anterior=h["estado_anterior"], estado_nuevo=h["estado_nuevo"],
            monto_usd=h["precio_acordado_usd"], cantidad=cantidad, unidad=unidad,
            datos={"etapa": ETAPA_POR_ESTADO_ORDEN.get(h["estado_nuevo"])},
        )

    for inicio in range(0, len(filas), 500):
        op.bulk_insert(eventos, filas[inicio:inicio + 500])


def downgrade() -> None:
    if "eventos" in _tablas():
        op.drop_table("eventos")
    if "configuracion_plataforma" in _tablas():
        op.drop_table("configuracion_plataforma")
    for tabla, columna in (
        ("importadores", "pedido_minimo_unidad"),
        ("importadores", "pedido_minimo"),
        ("recepciones_cotizacion", "asignado_por"),
        ("recepciones_cotizacion", "origen"),
        ("propuestas", "fecha_descarte"),
        ("propuestas", "motivo_descarte_detalle"),
        ("propuestas", "motivo_descarte"),
        ("propuestas", "cantidad"),
        ("cotizaciones", "motivo_eleccion_detalle"),
        ("cotizaciones", "motivo_eleccion"),
        ("cotizaciones", "unidad_cantidad"),
    ):
        if columna in _columnas(tabla):
            op.drop_column(tabla, columna)
