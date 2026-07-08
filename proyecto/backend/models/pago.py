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

    Desde la Semana 4, el único propósito de un pago es la **compra de créditos**
    (el solicitante recarga saldo que luego consume al crear cotizaciones). Ya no
    existe una "comisión sobre la orden": la plataforma solo conecta a las partes
    y la Orden se crea automáticamente cuando ambas aceptan mutuamente una
    propuesta (ver `routers/cotizaciones.py::pre_aceptar_propuesta`), sin pago de
    por medio.

    `wompi_payment_id` es UNIQUE, así que un mismo evento de webhook reenviado por
    Wompi nunca puede procesarse dos veces (idempotencia/ACID).
    """
    __tablename__ = "pagos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    wompi_payment_id = Column(String(100), unique=True, nullable=False, index=True)
    monto_usd = Column(Float, nullable=False)
    creditos_comprados = Column(Float, nullable=False)
    estado = Column(String(20), default=EstadoPago.pendiente, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_confirmacion = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Pago(id={self.id}, wompi_payment_id={self.wompi_payment_id}, estado={self.estado})>"
