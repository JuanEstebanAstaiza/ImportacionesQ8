from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class ModalidadCotizacion(str, enum.Enum):
    dirigida = "dirigida"
    abierta = "abierta"

class NivelPersonalizacion(str, enum.Enum):
    estandar = "estandar"
    personalizacion_marca = "personalizacion_marca"
    personalizacion_diseno_completo = "personalizacion_diseno_completo"

class TipoCalidad(str, enum.Enum):
    economica = "economica"
    estandar = "estandar"
    premium = "premium"

class ModalidadImportacion(str, enum.Enum):
    ecommerce = "ecommerce"
    corporativo = "corporativo"

class EstadoCotizacion(str, enum.Enum):
    creada = "creada"
    dirigida = "dirigida"
    abierta = "abierta"
    propuestas_recibidas = "propuestas_recibidas"
    cotizacion_aceptada = "cotizacion_aceptada"
    orden_activa = "orden_activa"

class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    solicitante_id = Column(String(36), nullable=False)
    importador_id = Column(String(36), nullable=True)  # Solo para modalidad dirigida
    modalidad = Column(String(20), nullable=False)  # "dirigida" o "abierta"
    foto_producto = Column(String(500), nullable=True)
    pais_importacion = Column(String(100), nullable=False)
    nivel_personalizacion = Column(String(50), nullable=True)
    nombre_producto = Column(String(255), nullable=False)
    descripcion_cliente = Column(Text, nullable=False)
    link_referencia = Column(String(500), nullable=True)
    linea_producto = Column(String(100), nullable=False)
    tipo_calidad = Column(String(20), nullable=False)
    modalidad_importacion = Column(String(20), nullable=True)
    cantidad_minima = Column(Integer, nullable=False)
    precio_objetivo_usd = Column(Float, nullable=True)
    incoterm = Column(String(50), nullable=False)
    notas_adicionales = Column(Text, nullable=True)
    estado = Column(String(30), default=EstadoCotizacion.creada)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Cotizacion(id={self.id}, solicitante_id={self.solicitante_id}, estado={self.estado})>"