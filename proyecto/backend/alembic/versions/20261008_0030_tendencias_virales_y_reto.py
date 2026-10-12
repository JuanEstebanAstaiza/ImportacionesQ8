"""Tendencias v2 (productos virales) y reto comunitario.

Tablas nuevas:
- `tendencias_items`: fichas que nacen de un enlace a TikTok, Instagram o
  YouTube; se aprueban y se publican con portada propia.
- `reto_rondas`, `reto_participaciones`, `cuentas_pago` (número y documento
  cifrados) y `reto_lista_espera`.

Columnas nuevas:
- `cotizaciones.tendencia_item_id`: la ficha de la que nace la solicitud.
- `usuarios.cotizaciones_gratis`: saldo ganado en el reto.

Las tablas de Tendencias v1 (ediciones semanales) se conservan con sus datos.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261008_0030"
down_revision: Union[str, None] = "20261007_0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tablas() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columnas(tabla: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(tabla)}


def _id() -> sa.Column:
    return sa.Column("id", sa.String(length=36), primary_key=True)


def upgrade() -> None:
    tablas = _tablas()

    if "reto_rondas" not in tablas:
        op.create_table(
            "reto_rondas",
            _id(),
            sa.Column("nombre", sa.String(length=80), nullable=False),
            sa.Column("max_participantes", sa.Integer(), nullable=False),
            sa.Column("umbral_aprobados", sa.Integer(), nullable=False),
            sa.Column("recompensa_cop", sa.Integer(), nullable=False),
            sa.Column("recompensa_cotizaciones", sa.Integer(), nullable=False),
            sa.Column("fecha_limite", sa.DateTime(), nullable=False),
            sa.Column("estado", sa.String(length=20), nullable=False, index=True),
            sa.Column("abrir_siguiente_al_llenarse", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("creada_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
        )

    if "reto_participaciones" not in tablas:
        op.create_table(
            "reto_participaciones",
            _id(),
            sa.Column("ronda_id", sa.String(length=36), sa.ForeignKey("reto_rondas.id"), nullable=False, index=True),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
            sa.Column("aprobados", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("eleccion", sa.String(length=20), nullable=True),
            sa.Column("estado_recompensa", sa.String(length=20), nullable=False),
            sa.Column("pagado_en", sa.DateTime(), nullable=True),
            sa.Column("referencia_pago", sa.String(length=120), nullable=True),
            sa.Column("aviso_faltan_pocos", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("ultimo_envio_en", sa.DateTime(), nullable=True),
            sa.Column("ultimo_aviso_inactividad", sa.DateTime(), nullable=True),
            sa.Column("fecha_inscripcion", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("ronda_id", "usuario_id", name="uq_reto_participacion"),
        )

    if "cuentas_pago" not in tablas:
        op.create_table(
            "cuentas_pago",
            _id(),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False, unique=True),
            sa.Column("banco", sa.String(length=80), nullable=False),
            sa.Column("tipo_cuenta", sa.String(length=20), nullable=False),
            sa.Column("numero_cifrado", sa.Text(), nullable=False),
            sa.Column("ultimos_digitos", sa.String(length=4), nullable=False),
            sa.Column("titular", sa.String(length=150), nullable=False),
            sa.Column("documento_cifrado", sa.Text(), nullable=False),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        )

    if "reto_lista_espera" not in tablas:
        op.create_table(
            "reto_lista_espera",
            _id(),
            sa.Column("email", sa.String(length=255), nullable=False, unique=True),
            sa.Column("usuario_id", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("avisado_en", sa.DateTime(), nullable=True),
            sa.Column("fecha", sa.DateTime(), nullable=False),
        )

    if "tendencias_items" not in tablas:
        op.create_table(
            "tendencias_items",
            _id(),
            sa.Column("url_origen", sa.String(length=1000), nullable=False),
            sa.Column("url_normalizada", sa.String(length=500), nullable=False, unique=True),
            sa.Column("plataforma", sa.String(length=20), nullable=False),
            sa.Column("id_video_plataforma", sa.String(length=120), nullable=True),
            sa.Column("autor_plataforma", sa.String(length=200), nullable=True),
            sa.Column("miniatura_plataforma_url", sa.String(length=1000), nullable=True),
            sa.Column("embed_html", sa.Text(), nullable=True),
            sa.Column("enviado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
            sa.Column("rol_remitente", sa.String(length=20), nullable=False),
            sa.Column("importador_id", sa.String(length=36), sa.ForeignKey("importadores.id"), nullable=True, index=True),
            sa.Column("participacion_id", sa.String(length=36), sa.ForeignKey("reto_participaciones.id"),
                      nullable=True, index=True),
            sa.Column("nota_remitente", sa.String(length=500), nullable=True),
            sa.Column("estado", sa.String(length=30), nullable=False, index=True),
            sa.Column("motivo_rechazo", sa.String(length=30), nullable=True),
            sa.Column("nombre", sa.String(length=120), nullable=True),
            sa.Column("categoria", sa.String(length=100), nullable=True, index=True),
            sa.Column("regulado", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("por_que_tendencia", sa.String(length=200), nullable=True),
            sa.Column("ojo_antes", sa.String(length=200), nullable=True),
            sa.Column("portada_url", sa.String(length=500), nullable=True),
            sa.Column("semana", sa.Date(), nullable=True, index=True),
            sa.Column("publicado_en", sa.DateTime(), nullable=True),
            sa.Column("aprobado_por", sa.String(length=36), sa.ForeignKey("usuarios.id"), nullable=True),
            sa.Column("revisado_en", sa.DateTime(), nullable=True),
            sa.Column("cotizaciones_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ultima_verificacion", sa.DateTime(), nullable=True),
            sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
            sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        )

    if "cotizaciones_gratis" not in _columnas("usuarios"):
        op.add_column("usuarios", sa.Column("cotizaciones_gratis", sa.Integer(), nullable=False, server_default="0"))
    if "tendencia_item_id" not in _columnas("cotizaciones"):
        op.add_column("cotizaciones", sa.Column("tendencia_item_id", sa.String(length=36), nullable=True))
        op.create_index("ix_cotizaciones_tendencia_item_id", "cotizaciones", ["tendencia_item_id"])


def downgrade() -> None:
    if "tendencia_item_id" in _columnas("cotizaciones"):
        op.drop_index("ix_cotizaciones_tendencia_item_id", table_name="cotizaciones")
        op.drop_column("cotizaciones", "tendencia_item_id")
    if "cotizaciones_gratis" in _columnas("usuarios"):
        op.drop_column("usuarios", "cotizaciones_gratis")
    tablas = _tablas()
    for tabla in ("tendencias_items", "reto_lista_espera", "cuentas_pago", "reto_participaciones", "reto_rondas"):
        if tabla in tablas:
            op.drop_table(tabla)
