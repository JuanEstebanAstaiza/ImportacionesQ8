"""Notificaciones persistentes del usuario (bandeja in-app)."""
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Index, JSON
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class TipoNotificacion(str, enum.Enum):
    sistema = "sistema"
    chat = "chat"
    cotizacion = "cotizacion"
    propuesta = "propuesta"
    orden = "orden"
    curso = "curso"
    negociacion = "negociacion"


class Notificacion(Base):
    __tablename__ = "notificaciones"
    __table_args__ = (
        Index("ix_notificaciones_usuario_leida", "usuario_id", "leida"),
        Index("ix_notificaciones_usuario_fecha", "usuario_id", "fecha_creacion"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String(40), nullable=False, default=TipoNotificacion.sistema.value)
    titulo = Column(String(255), nullable=False)
    mensaje = Column(Text, nullable=False, default="")
    # Payload opcional para deep-link en frontend: {orden_id, cotizacion_id, curso_id, ...}
    data = Column(JSON, nullable=True)
    # Referencias de primer nivel para el deep-link (también viajan en `data`,
    # pero como columnas se pueden filtrar e indexar).
    cotizacion_id = Column(String(36), nullable=True, index=True)
    conversacion_id = Column(String(36), nullable=True, index=True)
    leida = Column(Boolean, nullable=False, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_lectura = Column(DateTime, nullable=True)

    @property
    def cuerpo(self) -> str:
        """Nombre con el que el frontend lee el texto; en BD sigue siendo `mensaje`."""
        return self.mensaje

    def __repr__(self):
        return f"<Notificacion(id={self.id}, usuario_id={self.usuario_id}, tipo={self.tipo})>"
