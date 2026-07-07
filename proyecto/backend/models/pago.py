from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class EstadoPago(str, enum.Enum):
    pendiente = "pendiente"
    confirmado = "confirmado"
    fallido = "fallido"
    reembolsado = "reembolsado"

class Pago(Base):
    """
    Registro persistente de cada intento de pago con Wompi.

    Esta tabla es la pieza clave de idempotencia y trazabilidad (ACID) del flujo de
    pagos: `wompi_payment_id` es UNIQUE, así que un mismo evento de webhook
    reenviado por Wompi nunca puede procesarse dos veces (la segunda vez la
    búsqueda encuentra el pago ya "confirmado" y el webhook responde 200 OK sin
    duplicar efectos).
    """
    __tablename__ = "pagos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # La orden todavía no existe cuando se genera el checkout; se completa al confirmar el pago.
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=True)
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=False)
    wompi_payment_id = Column(String(100), unique=True, nullable=False, index=True)
    monto_usd = Column(Float, nullable=False)
    estado = Column(String(20), default=EstadoPago.pendiente, nullable=False)
    webhook_url = Column(String(500), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_confirmacion = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Pago(id={self.id}, wompi_payment_id={self.wompi_payment_id}, estado={self.estado})>"
