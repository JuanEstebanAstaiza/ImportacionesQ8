from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class TipoMensajeChat(str, enum.Enum):
    texto = "texto"
    archivo = "archivo"
    sistema = "sistema"  # Mensajes automáticos (ej: traspaso de chat al supervisor)

class ConversacionChat(Base):
    """Conversación de negociación entre el solicitante y la empresa importadora.

    Se crea apenas el solicitante acepta o rechaza una propuesta (no solo al
    confirmar el pago), para que el asesor asignado pueda empezar a negociar
    de inmediato. `orden_id` se completa más adelante si la cotización termina en
    un pago confirmado.
    """
    __tablename__ = "conversaciones_chat"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=False, unique=True)
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=True, unique=True)
    solicitante_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    # Usuario de la empresa importadora con quien negocia el solicitante: el
    # asesor que reclamó la cotización, o si nadie la reclamó, la cuenta dueña.
    importador_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    mensajes = relationship("MensajeChat", back_populates="conversacion", cascade="all, delete-orphan")
    cotizacion = relationship("Cotizacion", back_populates="conversacion")

    def __repr__(self):
        return f"<ConversacionChat(id={self.id}, cotizacion_id={self.cotizacion_id})>"

class MensajeChat(Base):
    __tablename__ = "mensajes_chat"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    conversacion_id = Column(String(36), ForeignKey("conversaciones_chat.id"), nullable=False)
    remitente_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    contenido = Column(Text, nullable=False)
    tipo = Column(String(20), default=TipoMensajeChat.texto)  # "texto" o "archivo"
    fecha_envio = Column(DateTime, default=datetime.utcnow)

    conversacion = relationship("ConversacionChat", back_populates="mensajes")

    def __repr__(self):
        return f"<MensajeChat(id={self.id}, conversacion_id={self.conversacion_id})>"
