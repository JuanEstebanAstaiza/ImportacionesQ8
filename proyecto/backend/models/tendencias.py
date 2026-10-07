"""Tendencias semanales: microcatálogo curado por Zarpi, de acceso por suscripción.

Cada lunes se publica una `EdicionTendencias` con hasta seis productos. Cada
producto explica por qué está en tendencia, hasta qué fecha conviene pedirlo
para que llegue a su temporada y cómo venderlo. La única acción comercial es
pedir propuestas, que abre una solicitud normal prellenada: Zarpi no vende el
producto ni muestra precios (por eso no hay campos de precio en ningún modelo).

Ver la especificación en docs/Especificación Tendencias semanales.html. A
diferencia de su V1, el acceso a las ediciones es privado: lo tienen quienes
pagan la suscripción o a quienes el equipo se la regala por un tiempo
(`AccesoTendencias`).
"""
import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    JSON, Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint,
)

from database import Base


class EstadoEdicion(str, enum.Enum):
    borrador = "borrador"
    programada = "programada"
    publicada = "publicada"
    archivada = "archivada"


class PresetEstilo(str, enum.Enum):
    lavanda = "lavanda"
    violeta = "violeta"
    amarillo = "amarillo"
    noche = "noche"


class TransporteSugerido(str, enum.Enum):
    mar = "mar"
    aereo = "aereo"


class OrigenAcceso(str, enum.Enum):
    pago = "pago"
    cortesia = "cortesia"


class EdicionTendencias(Base):
    __tablename__ = "tendencias_ediciones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    numero = Column(Integer, nullable=False, unique=True)
    semana_inicio = Column(Date, nullable=False)
    titulo_linea1 = Column(String(40), nullable=False)
    titulo_linea2 = Column(String(40), nullable=False)
    subtitulo = Column(String(140), nullable=False)
    preset_estilo = Column(String(20), nullable=False, default=PresetEstilo.lavanda.value)
    estado = Column(String(20), nullable=False, default=EstadoEdicion.borrador.value, index=True)
    # En UTC. La interfaz la muestra y la pide en hora de Bogotá.
    publicar_en = Column(DateTime, nullable=True)
    publicada_en = Column(DateTime, nullable=True)
    aviso_enviado_en = Column(DateTime, nullable=True)
    creado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    actualizado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow)


class ProductoTendencia(Base):
    __tablename__ = "tendencias_productos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    nombre = Column(String(80), nullable=False)
    categoria_visible = Column(String(40), nullable=False)
    # Línea de producto de Zarpi, para prellenar la solicitud y asignarla bien.
    linea_producto = Column(String(100), nullable=True)
    pais_origen = Column(String(100), nullable=False, default="China")
    fotos = Column(JSON, nullable=False, default=list)
    por_que_ahora = Column(String(220), nullable=False)
    temporada_id = Column(String(36), ForeignKey("tendencias_temporadas.id"), nullable=True)
    fecha_en_bodega = Column(Date, nullable=True)
    transporte_sugerido = Column(String(10), nullable=False, default=TransporteSugerido.mar.value)
    dias_mar = Column(Integer, nullable=True)
    dias_aereo = Column(Integer, nullable=True)
    revisar_requisitos = Column(Boolean, nullable=False, default=False, server_default="0")
    para_negocio = Column(Boolean, nullable=False, default=False, server_default="0")
    guia_para_quien = Column(Text, nullable=True)
    guia_angulos = Column(JSON, nullable=True)
    guia_donde = Column(Text, nullable=True)
    guia_contenido = Column(Text, nullable=True)
    que_pedir_en_cotizacion = Column(Text, nullable=True)
    # Siempre false en V1: la página de prueba llega en V2.
    pagina_prueba = Column(Boolean, nullable=False, default=False, server_default="0")
    creado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    actualizado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow)


class EdicionProducto(Base):
    """Un producto dentro de una edición. Un producto puede repetirse en otra."""
    __tablename__ = "tendencias_edicion_productos"

    edicion_id = Column(String(36), ForeignKey("tendencias_ediciones.id", ondelete="CASCADE"), primary_key=True)
    producto_id = Column(String(36), ForeignKey("tendencias_productos.id", ondelete="CASCADE"), primary_key=True)
    orden = Column(Integer, nullable=False, default=0)
    destacado = Column(Boolean, nullable=False, default=False, server_default="0")


class Temporada(Base):
    __tablename__ = "tendencias_temporadas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    nombre = Column(String(80), nullable=False)
    fecha = Column(Date, nullable=False, index=True)
    ejemplos = Column(String(200), nullable=True)


class CierreFabricas(Base):
    """Cierre de fábricas en China (Año Nuevo Lunar), uno por año."""
    __tablename__ = "tendencias_cierres_fabricas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    inicio = Column(Date, nullable=False)
    fin = Column(Date, nullable=False)
    fin_produccion_previa = Column(Date, nullable=False)


class GuardadoTendencia(Base):
    __tablename__ = "tendencias_guardados"
    __table_args__ = (UniqueConstraint("usuario_id", "producto_id", name="uq_tendencias_guardado"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    producto_id = Column(String(36), ForeignKey("tendencias_productos.id", ondelete="CASCADE"), nullable=False)
    edicion_id = Column(String(36), ForeignKey("tendencias_ediciones.id", ondelete="SET NULL"), nullable=True)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)


class SuscripcionAvisoTendencias(Base):
    """Autorización para recibir el aviso semanal. Va aparte del acceso pagado:
    se puede tener acceso y no querer correos, y al revés."""
    __tablename__ = "tendencias_suscripciones_aviso"

    usuario_id = Column(String(36), ForeignKey("usuarios.id"), primary_key=True)
    canal = Column(String(20), nullable=False, default="email")
    fecha_autorizacion = Column(DateTime, nullable=False, default=datetime.utcnow)


class AccesoTendencias(Base):
    """Un periodo de acceso a las ediciones, pagado o regalado por el equipo.

    El usuario tiene acceso mientras exista un periodo vigente
    (`inicio <= ahora < fin` y sin revocar). Renovar antes de que venza crea
    un periodo nuevo que empieza donde termina el anterior.
    """
    __tablename__ = "tendencias_accesos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    origen = Column(String(20), nullable=False)
    inicio = Column(DateTime, nullable=False)
    fin = Column(DateTime, nullable=False)
    pago_id = Column(String(36), ForeignKey("pagos.id"), nullable=True, unique=True)
    otorgado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    nota = Column(String(255), nullable=True)
    revocado_en = Column(DateTime, nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)


class CambioTendencias(Base):
    """Bitácora de cambios del curador: quién tocó qué y cuándo. Los cambios
    sobre una edición ya publicada son los que el administrador necesita ver."""
    __tablename__ = "tendencias_cambios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    edicion_id = Column(String(36), nullable=True, index=True)
    producto_id = Column(String(36), nullable=True)
    usuario_id = Column(String(36), nullable=True)
    accion = Column(String(40), nullable=False)
    sobre_publicada = Column(Boolean, nullable=False, default=False, server_default="0")
    datos = Column(JSON, nullable=True)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
