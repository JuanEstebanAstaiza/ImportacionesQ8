from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class TipoMensajeChat(str, enum.Enum):
    texto = "texto"
    archivo = "archivo"
    sistema = "sistema"  # Mensajes automáticos (ej: traspaso de chat al supervisor)


class TipoConversacion(str, enum.Enum):
    """Quiénes hablan en el hilo.

    Son dos canales con reglas de acceso distintas y no deben mezclarse: en el
    interno la empresa coordina a su equipo y el cliente no puede leerlo.
    """
    negociacion = "negociacion"  # solicitante ↔ empresa (cotización y, después, orden)
    interna = "interna"          # cuenta dueña de la empresa ↔ uno de sus asesores


class ConversacionChat(Base):
    """Hilo de mensajería, en cualquiera de sus dos formas.

    **negociacion** — solicitante ↔ empresa importadora. Nace en cuanto un asesor
    reclama la cotización, para que la negociación empiece sin esperar a que el
    cliente dé el primer paso. `orden_id` se rellena cuando la propuesta queda
    aceptada por ambas partes; a partir de ahí el mismo hilo pasa a ser el del
    seguimiento del embarque.

    **interna** — cuenta dueña ↔ asesor. Canal de coordinación del equipo, donde
    la empresa le indica al asesor cuándo mover el estado de una orden
    (despachado, en aduana...). Es un canal por asesor, no uno por orden: el
    asesor tiene un único hilo con su empresa.

    Las columnas que solo aplican a una de las dos formas van en nulo en la otra:
    `cotizacion_id`/`solicitante_id` en las internas, `importador_id` en las de
    negociación. Las restricciones únicas siguen valiendo porque en MySQL y
    SQLite un NULL no colisiona con otro.
    """
    __tablename__ = "conversaciones_chat"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tipo = Column(String(20), nullable=False, default=TipoConversacion.negociacion.value)
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=True, unique=True)
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=True, unique=True)
    solicitante_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    # Usuario de la empresa importadora con quien negocia el solicitante: el
    # asesor que reclamó la cotización, o si nadie la reclamó, la cuenta dueña.
    # En las conversaciones internas es el asesor del equipo.
    importador_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    # Solo en las internas: la empresa cuya cuenta dueña es el otro extremo. Se
    # guarda la empresa y no el usuario concreto para que el hilo sobreviva a un
    # cambio de representante legal.
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    mensajes = relationship("MensajeChat", back_populates="conversacion", cascade="all, delete-orphan")
    cotizacion = relationship("Cotizacion", back_populates="conversacion")

    __table_args__ = (
        # Un solo canal interno por asesor: sin esto, cada clic en "hablar con el
        # asesor" abriría un hilo nuevo y el historial quedaría troceado.
        UniqueConstraint("importador_id", "importador_usuario_id", name="unique_conversacion_interna"),
    )

    def __repr__(self):
        return f"<ConversacionChat(id={self.id}, tipo={self.tipo}, cotizacion_id={self.cotizacion_id})>"

class MensajeChat(Base):
    __tablename__ = "mensajes_chat"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    conversacion_id = Column(String(36), ForeignKey("conversaciones_chat.id"), nullable=False)
    remitente_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    contenido = Column(Text, nullable=False)
    tipo = Column(String(20), default=TipoMensajeChat.texto)  # "texto" o "archivo"
    # Ej. {"traducciones": {"en": "...", "zh-CN": "..."}}
    metadata_json = Column("metadata", JSON, nullable=True)
    fecha_envio = Column(DateTime, default=datetime.utcnow)

    conversacion = relationship("ConversacionChat", back_populates="mensajes")

    def __repr__(self):
        return f"<MensajeChat(id={self.id}, conversacion_id={self.conversacion_id})>"
