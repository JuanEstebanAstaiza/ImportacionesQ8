from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class EstadoPropuesta(str, enum.Enum):
    pendiente = "pendiente"
    aceptada = "aceptada"
    rechazada = "rechazada"

class Propuesta(Base):
    __tablename__ = "propuestas"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=False)
    importador_id = Column(String(36), nullable=False)
    precio_ofrecido_usd = Column(Float, nullable=False)
    tiempo_estimado_entrega = Column(String(100), nullable=False)  # ej: "45 días"
    incoterm = Column(String(50), nullable=False)  # Incoterm propuesto por el importador (FOB, CIF, EXW, DDP...)
    condiciones_adicionales = Column(Text, nullable=True)
    estado = Column(String(20), default=EstadoPropuesta.pendiente)  # "pendiente", "aceptada", "rechazada"
    fecha_envio = Column(DateTime, default=datetime.utcnow)

    # Restricción única: un importador solo puede enviar UNA propuesta por cotización
    __table_args__ = (
        UniqueConstraint("cotizacion_id", "importador_id", name="unique_propuesta_cotizacion_importador"),
    )

    # Relaciones
    cotizacion = relationship("Cotizacion", back_populates="propuestas")

    def __repr__(self):
        return f"<Propuesta(id={self.id}, cotizacion_id={self.cotizacion_id}, importador_id={self.importador_id}, estado={self.estado})>"