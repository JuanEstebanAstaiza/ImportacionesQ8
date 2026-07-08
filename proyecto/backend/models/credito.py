from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class TipoMovimientoCredito(str, enum.Enum):
    compra = "compra"
    consumo = "consumo"
    reembolso = "reembolso"


class MovimientoCredito(Base):
    """
    Historial de movimientos del saldo de créditos de un solicitante (Semana 4):
    - "compra": recarga confirmada vía Wompi (`Pago`).
    - "consumo": costo descontado al crear una cotización (abierta o dirigida).
    - "reembolso": crédito devuelto por un admin cuando una recreación de
      cotización (Fase 3) se atribuye a un error de la empresa importadora.
    """
    __tablename__ = "movimientos_credito"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # "compra" | "consumo" | "reembolso"
    monto = Column(Float, nullable=False)  # positivo en compra/reembolso, negativo en consumo
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=True)
    pago_id = Column(String(36), ForeignKey("pagos.id"), nullable=True)
    descripcion = Column(Text, nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<MovimientoCredito(usuario_id={self.usuario_id}, tipo={self.tipo}, monto={self.monto})>"
