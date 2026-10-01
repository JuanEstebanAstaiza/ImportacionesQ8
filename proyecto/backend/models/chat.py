from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

# MySQL trunca DATETIME a segundos enteros si no se le pide precisión. Con eso,
# un mensaje que llega en el mismo segundo en que alguien marca el hilo como
# leído queda "antes o igual" que la lectura y desaparece del contador de no
# leídos. SQLite sí guarda microsegundos, así que el fallo solo se ve contra la
# base real. Las dos columnas que se comparan entre sí necesitan la misma
# precisión, de ahí que este tipo se use en ambas.
MARCA_DE_TIEMPO = DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql")

class TipoMensajeChat(str, enum.Enum):
    texto = "texto"
    archivo = "archivo"
    sistema = "sistema"  # Mensajes automáticos (ej: traspaso de chat al supervisor)
    # Precio estimado con la calculadora de la empresa. Solo lo crea
    # `POST /chat/conversaciones/{id}/estimaciones`, que recalcula el desglose
    # en el servidor: el cliente no puede forjarlo por los canales genéricos.
    estimacion = "estimacion"


class TipoConversacion(str, enum.Enum):
    """Quiénes hablan en el hilo.

    Son canales con reglas de acceso distintas y no deben mezclarse: en el
    interno la empresa coordina a su equipo y el cliente no puede leerlo; en el
    de soporte hablan un usuario cualquiera y el equipo de la plataforma.
    """
    negociacion = "negociacion"  # solicitante ↔ empresa (cotización y, después, orden)
    interna = "interna"          # cuenta dueña de la empresa ↔ uno de sus asesores
    soporte = "soporte"          # cualquier usuario ↔ equipo de la plataforma


class UrgenciaSoporte(str, enum.Enum):
    """Prioridad con la que el usuario pide ayuda.

    El orden importa para la bandeja: se atiende de arriba abajo, así que se
    guarda también el peso con el que se ordena.
    """
    critica = "critica"
    alta = "alta"
    media = "media"
    baja = "baja"


# Mayor peso, más arriba en la bandeja de soporte.
PESO_URGENCIA = {
    UrgenciaSoporte.critica.value: 4,
    UrgenciaSoporte.alta.value: 3,
    UrgenciaSoporte.media.value: 2,
    UrgenciaSoporte.baja.value: 1,
}


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

    **soporte** — cualquier usuario ↔ equipo de la plataforma. Lo abre quien
    necesita ayuda (`solicitante_id` es quien la pide, sea del rol que sea) con
    un asunto y una urgencia; no hay lado empresa, por eso
    `importador_usuario_id` va en nulo aquí.

    Las columnas que solo aplican a una de las formas van en nulo en las demás.
    Las restricciones únicas siguen valiendo porque en MySQL y SQLite un NULL no
    colisiona con otro.
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
    # En los tickets de soporte no hay lado empresa, de ahí que admita NULL.
    importador_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    # Solo en las internas: la empresa cuya cuenta dueña es el otro extremo. Se
    # guarda la empresa y no el usuario concreto para que el hilo sobreviva a un
    # cambio de representante legal.
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=True)
    # Solo en los tickets de soporte.
    asunto = Column(String(160), nullable=True)
    urgencia = Column(String(20), nullable=True)
    # Nivel de mesa que requiere el caso y agente que lo atiende. La asignación
    # es automática al abrirlo (ver `asignar_agente`), y un agente puede escalar
    # el ticket si al leerlo ve que le queda grande.
    nivel = Column(Integer, nullable=True)
    agente_asignado_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    # Calificación del servicio, que solo puede dar quien pidió la ayuda y solo
    # una vez cerrado: puntuar antes sería puntuar una promesa.
    calificacion = Column(Integer, nullable=True)
    comentario_calificacion = Column(Text, nullable=True)
    fecha_calificacion = Column(DateTime, nullable=True)
    # Un ticket cerrado sale de la bandeja de pendientes pero no se borra: la
    # resolución queda escrita para poder consultarla si el problema vuelve.
    cerrada = Column(Boolean, nullable=False, default=False)
    resolucion = Column(Text, nullable=True)
    cerrada_por_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_cierre = Column(DateTime, nullable=True)
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
    # Ver MARCA_DE_TIEMPO: se compara con la marca de lectura.
    fecha_envio = Column(MARCA_DE_TIEMPO, default=datetime.utcnow)

    conversacion = relationship("ConversacionChat", back_populates="mensajes")

    def __repr__(self):
        return f"<MensajeChat(id={self.id}, conversacion_id={self.conversacion_id})>"


class LecturaConversacion(Base):
    """Hasta dónde ha leído cada participante en cada hilo.

    Sin esto no existe el concepto de "no leído": el contador de la interfaz
    estaba escrito a cero, así que el filtro de no leídas no podía funcionar y
    nadie sabía qué conversaciones tenían algo pendiente de mirar.

    Se guarda una marca de tiempo y no una lista de mensajes leídos: basta para
    contar lo posterior y no crece con el volumen de mensajes.
    """
    __tablename__ = "lecturas_conversacion"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    conversacion_id = Column(String(36), ForeignKey("conversaciones_chat.id"), nullable=False)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    fecha_ultima_lectura = Column(MARCA_DE_TIEMPO, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("conversacion_id", "usuario_id", name="unique_lectura_por_usuario"),
    )

    def __repr__(self):
        return f"<LecturaConversacion(conversacion_id={self.conversacion_id}, usuario_id={self.usuario_id})>"
