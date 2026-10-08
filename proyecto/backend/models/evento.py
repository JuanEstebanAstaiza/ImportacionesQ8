from sqlalchemy import JSON, Column, DateTime, Float, Index, String, Text
from sqlalchemy.dialects import mysql
from uuid import uuid4
from datetime import datetime

from database import Base

# MySQL guarda DATETIME sin fracciones de segundo si no se le pide: dos eventos
# del mismo request (asignada + vista, aceptada + descartadas) quedarían con la
# misma marca y no se podría reconstruir el orden en que pasaron.
FechaEvento = DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql")


class Evento(Base):
    """Bitácora de cada cambio de estado del negocio, con su fecha y hora (UTC).

    Es un registro de solo inserción: nada lo actualiza ni lo borra, y las
    métricas del panel se calculan a partir de él. Por eso guarda los montos ya
    convertidos con la TRM del momento (`trm`, `monto_cop`) en lugar de
    recalcularlos después con la del día en que se consulte.

    No tiene llaves foráneas a propósito: la bitácora tiene que sobrevivir a una
    cotización cancelada o a una empresa dada de baja.

    Tipos en `services/eventos.py` (`TiposEvento`).
    """
    __tablename__ = "eventos"
    __table_args__ = (
        Index("ix_eventos_tipo_fecha", "tipo", "fecha"),
        Index("ix_eventos_importador_fecha", "importador_id", "fecha"),
        Index("ix_eventos_cotizacion", "cotizacion_id"),
        Index("ix_eventos_orden", "orden_id"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tipo = Column(String(40), nullable=False)
    fecha = Column(FechaEvento, nullable=False, default=datetime.utcnow)

    cotizacion_id = Column(String(36), nullable=True)
    propuesta_id = Column(String(36), nullable=True)
    orden_id = Column(String(36), nullable=True)
    importador_id = Column(String(36), nullable=True)

    # Quién lo provocó (NULL si fue el sistema, p. ej. el reparto automático).
    usuario_id = Column(String(36), nullable=True)
    rol_usuario = Column(String(20), nullable=True)

    estado_anterior = Column(String(40), nullable=True)
    estado_nuevo = Column(String(40), nullable=True)

    # Motivo de descarte: "precio", "tiempo", "condiciones" u "otro".
    motivo = Column(String(20), nullable=True)
    motivo_detalle = Column(Text, nullable=True)

    # Monto en su moneda de origen y convertido a pesos con la TRM del momento.
    monto = Column(Float, nullable=True)
    moneda = Column(String(10), nullable=True)
    monto_usd = Column(Float, nullable=True)
    trm = Column(Float, nullable=True)
    monto_cop = Column(Float, nullable=True)

    cantidad = Column(Float, nullable=True)
    unidad = Column(String(20), nullable=True)  # "unidades" o "m3"

    datos = Column(JSON, nullable=True)

    def __repr__(self):
        return f"<Evento(tipo={self.tipo}, cotizacion_id={self.cotizacion_id}, fecha={self.fecha})>"
