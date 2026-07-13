from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class TipoMovimientoCredito(str, enum.Enum):
    compra = "compra"
    consumo = "consumo"
    reembolso = "reembolso"
    bono_referido = "bono_referido"
    bono_referidor = "bono_referidor"
    bono_registro = "bono_registro"


class MovimientoCredito(Base):
    """
    Historial de movimientos del saldo de créditos de quien cotiza:
    - "compra": recarga confirmada vía Wompi (`Pago`).
    - "consumo": costo descontado al crear una cotización.
    - "reembolso": crédito devuelto por recreación atribuida a la importadora.
    - "bono_referido" / "bono_referidor": referidos.
    - "bono_registro": crédito de bienvenida.
    usuario_id = quien ejecutó la acción (auditoría).
    organizacion_id = wallet corporativo si aplica.
    """
    __tablename__ = "movimientos_credito"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    organizacion_id = Column(String(36), ForeignKey("organizaciones_solicitantes.id"), nullable=True, index=True)
    tipo = Column(String(20), nullable=False)
    monto = Column(Float, nullable=False)  # positivo en compra/reembolso/bono, negativo en consumo
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=True)
    pago_id = Column(String(36), ForeignKey("pagos.id"), nullable=True)
    descripcion = Column(Text, nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<MovimientoCredito(usuario_id={self.usuario_id}, tipo={self.tipo}, monto={self.monto})>"
