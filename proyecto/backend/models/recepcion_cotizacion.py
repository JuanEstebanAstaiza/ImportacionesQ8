from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, UniqueConstraint, true
from uuid import uuid4
from datetime import datetime

from database import Base


class RecepcionCotizacion(Base):
    """Cada vez que una cotización llega (o debía llegar) a una empresa.

    Es lo que cuenta el cupo diario de `Importador.limite_cotizaciones_diarias`:
    las dirigidas se registran al crearse y las abiertas al pasar por el
    matching. Las abiertas que el matching dejó fuera porque la empresa ya
    había agotado su cupo se guardan con `entregada=False`, para no volver a
    enseñárselas en la bandeja ni aceptar propuestas sobre ellas; esas no
    cuentan para el cupo.
    """
    __tablename__ = "recepciones_cotizacion"
    __table_args__ = (
        UniqueConstraint("importador_id", "cotizacion_id", name="uq_recepcion_importador_cotizacion"),
        Index("ix_recepciones_importador_fecha", "importador_id", "fecha_recepcion"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False)
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=False, index=True)
    modalidad = Column(String(20), nullable=False)  # "dirigida" o "abierta"
    entregada = Column(Boolean, default=True, server_default=true(), nullable=False)
    fecha_recepcion = Column(DateTime, default=datetime.utcnow, nullable=False)
