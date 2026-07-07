from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class EstadoOrden(str, enum.Enum):
    cotizacion_aceptada = "cotizacion_aceptada"
    en_produccion = "en_produccion"
    transito_internacional = "transito_internacional"
    aduana_nacionalizacion = "aduana_nacionalizacion"
    bodega_local = "bodega_local"
    entregado = "entregado"

class TipoDocumentoOrden(str, enum.Enum):
    factura_proforma = "factura_proforma"
    factura_comercial = "factura_comercial"
    packing_list = "packing_list"
    comprobante_pago = "comprobante_pago"

class Orden(Base):
    __tablename__ = "ordenes"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # unique=True: una cotización solo puede convertirse en UNA orden (1:1). Esta
    # restricción a nivel de base de datos es la garantía ACID real contra la
    # creación de órdenes duplicadas bajo condiciones de carrera (ej. reintentos
    # del webhook de Wompi o doble clic del usuario).
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=False, unique=True)
    importador_id = Column(String(36), nullable=False)
    solicitante_id = Column(String(36), nullable=False)
    asesor_asignado_id = Column(String(36), nullable=True)  # Se asignará cuando el importador acepte la orden
    estado = Column(String(30), default=EstadoOrden.cotizacion_aceptada)
    precio_acordado_usd = Column(Float, nullable=False)
    tiempo_estimado_entrega = Column(String(100), nullable=True)
    condiciones_adicionales = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    cotizacion = relationship("Cotizacion", back_populates="orden")
    historial_estados = relationship("HistorialEstadosOrden", back_populates="orden", cascade="all, delete-orphan")
    documentos_adjuntos = relationship("DocumentoOrden", back_populates="orden", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Orden(id={self.id}, estado={self.estado})>"

class HistorialEstadosOrden(Base):
    __tablename__ = "historial_estados_orden"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=False)
    estado_anterior = Column(String(30), nullable=True)  # None si es el primer estado
    estado_nuevo = Column(String(30), nullable=False)
    fecha_cambio = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    orden = relationship("Orden", back_populates="historial_estados")

    def __repr__(self):
        return f"<HistorialEstadosOrden(orden_id={self.orden_id}, {self.estado_anterior} → {self.estado_nuevo})>"

class DocumentoOrden(Base):
    __tablename__ = "documentos_orden"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=False)
    nombre = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    tipo = Column(String(30), nullable=False)  # "factura_proforma", "factura_comercial", "packing_list", "comprobante_pago"

    # Relaciones
    orden = relationship("Orden", back_populates="documentos_adjuntos")

    def __repr__(self):
        return f"<DocumentoOrden(orden_id={self.orden_id}, tipo={self.tipo})>"