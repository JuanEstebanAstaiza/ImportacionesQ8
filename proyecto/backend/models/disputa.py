from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class EstadoDisputa(str, enum.Enum):
    abierta = "abierta"
    en_mediacion = "en_mediacion"
    resuelta = "resuelta"
    cerrada = "cerrada"


class TipoEvidenciaDisputa(str, enum.Enum):
    imagen = "imagen"
    documento = "documento"
    otro = "otro"


class TipoMensajeDisputa(str, enum.Enum):
    texto = "texto"
    sistema = "sistema"
    admin = "admin"


class Disputa(Base):
    """Sala de disputa asociada a una orden (amplía el flag en_disputa)."""
    __tablename__ = "disputas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=False, unique=True, index=True)
    abierta_por_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    estado = Column(String(20), nullable=False, default=EstadoDisputa.abierta.value)
    motivo = Column(Text, nullable=False)
    resolucion_admin = Column(Text, nullable=True)
    resuelta_por_admin_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_apertura = Column(DateTime, default=datetime.utcnow)
    fecha_resolucion = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Disputa(id={self.id}, orden_id={self.orden_id}, estado={self.estado})>"


class EvidenciaDisputa(Base):
    __tablename__ = "evidencias_disputa"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    disputa_id = Column(String(36), ForeignKey("disputas.id"), nullable=False, index=True)
    subido_por_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    url = Column(String(500), nullable=False)
    tipo = Column(String(20), nullable=False, default=TipoEvidenciaDisputa.documento.value)
    descripcion = Column(Text, nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow)


class MensajeDisputa(Base):
    __tablename__ = "mensajes_disputa"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    disputa_id = Column(String(36), ForeignKey("disputas.id"), nullable=False, index=True)
    autor_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    contenido = Column(Text, nullable=False)
    tipo = Column(String(20), nullable=False, default=TipoMensajeDisputa.texto.value)
    fecha = Column(DateTime, default=datetime.utcnow)
