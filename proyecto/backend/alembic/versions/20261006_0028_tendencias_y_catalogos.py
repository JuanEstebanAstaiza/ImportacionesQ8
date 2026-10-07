"""Tendencias semanales (suscripción) y catálogos selectos de empresas.

Tablas nuevas:
- `tendencias_*`: ediciones, productos, productos por edición, temporadas,
  cierres de fábricas, guardados, autorización del aviso semanal, periodos de
  acceso (pagados o de cortesía) y bitácora de cambios del curador.
- `catalogos_empresa`, `catalogo_productos`, `catalogo_accesos`.

Columnas nuevas:
- `usuarios.es_curador`: capacidad de curador, aparte del rol.
- `pagos.concepto`, `pagos.monto_cop`, `pagos.dias_acceso`: un pago ya no es
  solo una recarga de créditos; también puede ser la suscripción a Tendencias.
- `cotizaciones.origen` y los ids de edición y producto de origen, para medir
  cuántas solicitudes trae cada edición, producto y catálogo.

Siembra el calendario inicial de temporadas y el cierre de fábricas de 2027
(ver services/tendencias_calculo.py), que el admin puede editar.
"""
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20261006_0028"
down_revision: Union[str, None] = "20261006_0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tablas() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def _agregar(tabla: str, columna: sa.Column) -> None:
    if columna.name not in _columnas(tabla):
        op.add_column(tabla, columna)


def _id() -> sa.Column:
    return sa.Column("id", sa.String(length=36), primary_key=True)


def upgrade() -> None:
    tablas = _tablas()

    if "tendencias_temporadas" not in tablas:
        op.create_table(
            "tendencias_temporadas",
            _id(),
            sa.Column("nombre", sa.String(length=80), nullable=False),
            sa.Column("fecha", sa.Date(), nullable=False, index=True),
            sa.Column("ejemplos", sa.String(length=200), nullable=True),
        )
        from services.tendencias_calculo import TEMPORADAS_INICIALES

        op.bulk_insert(
            sa.table(
                "tendencias_temporadas",
                sa.column("id", sa.String), sa.column("nombre", sa.String),
                sa.column("fecha", sa.Date), sa.column("ejemplos", sa.String),
            ),
            [{"id": str(uuid4()), "nombre": n, "fecha": f, "ejemplos": e} for n, f, e in TEMPORADAS_INICIALES],
        )

    if "tendencias_cierres_fabricas" not in tablas:
        op.create_table(
            "tendencias_cierres_fabricas",
            _id(),
            sa.Column("inicio", sa.Date(), nullable=False),
            sa.Column("fin", sa.Date(), nullable=False),
            sa.Column("fin_produccion_previa", sa.Date(), nullable=False),
        )
        from services.tendencias_calculo import CIERRES_INICIALES

        op.bulk_insert(
            sa.table(
                "tendencias_cierres_fabricas",
                sa.column("id", sa.String), sa.column("inicio", sa.Date),
                sa.column("fin", sa.Date), sa.column("fin_produccion_previa", sa.Date),
            ),
            [{"id": str(uuid4()), "inicio": i, "fin": f, "fin_produccion_previa": p} for i, f, p in CIERRES_INICIALES],
        )

    if "tendencias_ediciones" not in tablas:
        op.create_table(
            "tendencias_ediciones",
            _id(),
            sa.Column("numero", sa.Integer(), nullable=False, unique=True),
            sa.Column("semana_inicio", sa.Date(), nullable=False),
            sa.Column("titulo_linea1", sa.String(length=40), nullable=False),
            sa.Column("titulo_linea2", sa.String(length=40), nullable=False),
            sa.Column("subtitulo", sa.String(length=140), nullable=False),
            sa.Column("preset_estilo", sa.String(length=20), nullable=False),
            sa.Column("estado", sa.String(length=20), nullable=False, index=True),
            sa.Column("publicar_en", sa.DateTime(), nullable=True),
            sa.Column("publicada_en", sa.DateTime(), nullable=True),
            sa.Column("aviso_enviado_en", sa.DateTime(), nullable=True),
            sa.Column("creado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("actualizado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        )

    if "tendencias_productos" not in tablas:
        op.create_table(
            "tendencias_productos",
            _id(),
            sa.Column("nombre", sa.String(length=80), nullable=False),
            sa.Column("categoria_visible", sa.String(length=40), nullable=False),
            sa.Column("linea_producto", sa.String(length=100), nullable=True),
            sa.Column("pais_origen", sa.String(length=100), nullable=False),
            sa.Column("fotos", sa.JSON(), nullable=False),
            sa.Column("por_que_ahora", sa.String(length=220), nullable=False),
            sa.Column("temporada_id", sa.String(length=36), sa.ForeignKey("tendencias_temporadas.id"), nullable=True),
            sa.Column("fecha_en_bodega", sa.Date(), nullable=True),
            sa.Column("transporte_sugerido", sa.String(length=10), nullable=False),
            sa.Column("dias_mar", sa.Integer(), nullable=True),
            sa.Column("dias_aereo", sa.Integer(), nullable=True),
            sa.Column("revisar_requisitos", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("para_negocio", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("guia_para_quien", sa.Text(), nullable=True),
            sa.Column("guia_angulos", sa.JSON(), nullable=True),
            sa.Column("guia_donde", sa.Text(), nullable=True),
            sa.Column("guia_contenido", sa.Text(), nullable=True),
            sa.Column("que_pedir_en_cotizacion", sa.Text(), nullable=True),
            sa.Column("pagina_prueba", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("creado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("actualizado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        )

    if "tendencias_edicion_productos" not in tablas:
        op.create_table(
            "tendencias_edicion_productos",
            sa.Column("edicion_id", sa.String(length=36),
                      sa.ForeignKey("tendencias_ediciones.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("producto_id", sa.String(length=36),
                      sa.ForeignKey("tendencias_productos.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("orden", sa.Integer(), nullable=False),
            sa.Column("destacado", sa.Boolean(), nullable=False, server_default="0"),
        )

    if "tendencias_guardados" not in tablas:
        op.create_table(
            "tendencias_guardados",
            _id(),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
            sa.Column("producto_id", sa.String(length=36),
                      sa.ForeignKey("tendencias_productos.id", ondelete="CASCADE"), nullable=False),
            sa.Column("edicion_id", sa.String(length=36),
                      sa.ForeignKey("tendencias_ediciones.id", ondelete="SET NULL"), nullable=True),
            sa.Column("fecha", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("usuario_id", "producto_id", name="uq_tendencias_guardado"),
        )

    if "tendencias_suscripciones_aviso" not in tablas:
        op.create_table(
            "tendencias_suscripciones_aviso",
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), primary_key=True),
            sa.Column("canal", sa.String(length=20), nullable=False),
            sa.Column("fecha_autorizacion", sa.DateTime(), nullable=False),
        )

    if "tendencias_accesos" not in tablas:
        op.create_table(
            "tendencias_accesos",
            _id(),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
            sa.Column("origen", sa.String(length=20), nullable=False),
            sa.Column("inicio", sa.DateTime(), nullable=False),
            sa.Column("fin", sa.DateTime(), nullable=False),
            sa.Column("pago_id", sa.String(length=36), sa.ForeignKey("pagos.id"), nullable=True, unique=True),
            sa.Column("otorgado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("nota", sa.String(length=255), nullable=True),
            sa.Column("revocado_en", sa.DateTime(), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
        )

    if "tendencias_cambios" not in tablas:
        op.create_table(
            "tendencias_cambios",
            _id(),
            sa.Column("edicion_id", sa.String(length=36), nullable=True, index=True),
            sa.Column("producto_id", sa.String(length=36), nullable=True),
            sa.Column("usuario_id", sa.String(length=36), nullable=True),
            sa.Column("accion", sa.String(length=40), nullable=False),
            sa.Column("sobre_publicada", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("datos", sa.JSON(), nullable=True),
            sa.Column("fecha", sa.DateTime(), nullable=False, index=True),
        )

    if "catalogos_empresa" not in tablas:
        op.create_table(
            "catalogos_empresa",
            _id(),
            sa.Column("importador_id", sa.String(length=36), sa.ForeignKey("importadores.id"), nullable=False, index=True),
            sa.Column("titulo", sa.String(length=80), nullable=False),
            sa.Column("descripcion", sa.String(length=300), nullable=True),
            sa.Column("criterio", sa.String(length=30), nullable=False),
            sa.Column("tier_minimo", sa.String(length=10), nullable=True),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        )

    if "catalogo_productos" not in tablas:
        op.create_table(
            "catalogo_productos",
            _id(),
            sa.Column("catalogo_id", sa.String(length=36),
                      sa.ForeignKey("catalogos_empresa.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("nombre", sa.String(length=120), nullable=False),
            sa.Column("descripcion", sa.Text(), nullable=True),
            sa.Column("fotos", sa.JSON(), nullable=False),
            sa.Column("linea_producto", sa.String(length=100), nullable=True),
            sa.Column("pais_origen", sa.String(length=100), nullable=False),
            sa.Column("cantidad_minima", sa.Float(), nullable=True),
            sa.Column("unidad_cantidad", sa.String(length=10), nullable=False),
            sa.Column("tiempo_estimado", sa.String(length=80), nullable=True),
            sa.Column("que_pedir_en_cotizacion", sa.Text(), nullable=True),
            sa.Column("orden", sa.Integer(), nullable=False),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        )

    if "catalogo_accesos" not in tablas:
        op.create_table(
            "catalogo_accesos",
            _id(),
            sa.Column("catalogo_id", sa.String(length=36),
                      sa.ForeignKey("catalogos_empresa.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
            sa.Column("otorgado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("fecha", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("catalogo_id", "usuario_id", name="uq_catalogo_acceso"),
        )

    _agregar("usuarios", sa.Column("es_curador", sa.Boolean(), nullable=False, server_default="0"))

    _agregar("pagos", sa.Column("concepto", sa.String(length=30), nullable=False, server_default="creditos"))
    _agregar("pagos", sa.Column("monto_cop", sa.Float(), nullable=True))
    _agregar("pagos", sa.Column("dias_acceso", sa.Integer(), nullable=True))

    _agregar("cotizaciones", sa.Column("origen", sa.String(length=20), nullable=False, server_default="directa"))
    _agregar("cotizaciones", sa.Column("tendencia_edicion_id", sa.String(length=36), nullable=True))
    _agregar("cotizaciones", sa.Column("tendencia_producto_id", sa.String(length=36), nullable=True))
    _agregar("cotizaciones", sa.Column("catalogo_producto_id", sa.String(length=36), nullable=True))
    indices = {i["name"] for i in sa.inspect(op.get_bind()).get_indexes("cotizaciones")}
    for columna in ("tendencia_edicion_id", "tendencia_producto_id", "catalogo_producto_id"):
        nombre = f"ix_cotizaciones_{columna}"
        if nombre not in indices:
            op.create_index(nombre, "cotizaciones", [columna])


def downgrade() -> None:
    indices = {i["name"] for i in sa.inspect(op.get_bind()).get_indexes("cotizaciones")}
    for columna in ("tendencia_edicion_id", "tendencia_producto_id", "catalogo_producto_id"):
        nombre = f"ix_cotizaciones_{columna}"
        if nombre in indices:
            op.drop_index(nombre, table_name="cotizaciones")
    for tabla, columna in (
        ("cotizaciones", "catalogo_producto_id"), ("cotizaciones", "tendencia_producto_id"),
        ("cotizaciones", "tendencia_edicion_id"), ("cotizaciones", "origen"),
        ("pagos", "dias_acceso"), ("pagos", "monto_cop"), ("pagos", "concepto"),
        ("usuarios", "es_curador"),
    ):
        if columna in _columnas(tabla):
            op.drop_column(tabla, columna)

    tablas = _tablas()
    for tabla in (
        "catalogo_accesos", "catalogo_productos", "catalogos_empresa",
        "tendencias_cambios", "tendencias_accesos", "tendencias_suscripciones_aviso",
        "tendencias_guardados", "tendencias_edicion_productos", "tendencias_productos",
        "tendencias_ediciones", "tendencias_cierres_fabricas", "tendencias_temporadas",
    ):
        if tabla in tablas:
            op.drop_table(tabla)
