"""Comprobantes de pago manuales (mientras se habilita la pasarela).

«Cargue y descargue de pagos» en el módulo de Pagos:
- `tokens`: el usuario sube el comprobante de la compra de tokens de cotización;
  el admin lo revisa y, al aprobar, se le acreditan los tokens.
- `suscripcion`: igual, para la suscripción a Tendencias (se acreditan días).
- `reto`: el equipo sube el comprobante de la transferencia de una recompensa
  del reto en efectivo; el usuario solo puede verlo y descargarlo.

El archivo vive en gestión documental (carpeta «Pagos/…» de quien lo sube).
"""
import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from database import Base


class TipoComprobante(str, enum.Enum):
    tokens = "tokens"
    suscripcion = "suscripcion"
    reto = "reto"


class EstadoComprobante(str, enum.Enum):
    pendiente = "pendiente"
    aprobado = "aprobado"
    rechazado = "rechazado"
    # Comprobante del equipo (reto): solo informativo.
    enviado = "enviado"


class ComprobantePago(Base):
    __tablename__ = "comprobantes_pago"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # A quién corresponde el pago (quien lo hizo o, en el reto, quien lo recibe).
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False, index=True)
    estado = Column(String(20), nullable=False, default=EstadoComprobante.pendiente.value, index=True)
    archivo_id = Column(String(36), ForeignKey("archivos.id"), nullable=False, index=True)
    subido_por = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    # Lo que declara quien sube el comprobante (tokens o días que pagó, y el monto).
    cantidad_solicitada = Column(Integer, nullable=True)
    monto_cop = Column(Integer, nullable=True)
    nota = Column(String(500), nullable=True)
    # Lo que decide el admin al revisar.
    cantidad_acreditada = Column(Integer, nullable=True)
    motivo_rechazo = Column(String(300), nullable=True)
    revisado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    revisado_en = Column(DateTime, nullable=True)
    # Solo `reto`: la participación pagada.
    participacion_id = Column(String(36), ForeignKey("reto_participaciones.id"), nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
