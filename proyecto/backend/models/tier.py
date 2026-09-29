from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from datetime import datetime
from uuid import uuid4

from database import Base


class UmbralTierCotizante(Base):
    __tablename__ = "umbrales_tier_cotizante"

    tier = Column(String(10), primary_key=True)
    minimo_cotizaciones = Column(Integer, nullable=False, default=0)
    minimo_ordenes = Column(Integer, nullable=False, default=0)
    minimo_valor_operaciones_usd = Column(Float, nullable=False, default=0.0)
    actualizado_por_admin_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MovimientoPuntoCotizacion(Base):
    __tablename__ = "movimientos_puntos_cotizacion"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    admin_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=True)
    tipo = Column(String(20), nullable=False)
    delta = Column(Integer, nullable=False)
    saldo_resultante = Column(Integer, nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow, nullable=False)