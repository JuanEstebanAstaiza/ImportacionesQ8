from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class TipoEvidenciaImportador(str, enum.Enum):
    certificado = "certificado"
    foto_fabrica = "foto_fabrica"
    catalogo = "catalogo"
    moq_doc = "moq_doc"
    otro = "otro"


class EstadoEvidenciaImportador(str, enum.Enum):
    pendiente = "pendiente"
    aprobada = "aprobada"
    rechazada = "rechazada"


class EvidenciaImportador(Base):
    """Evidencias de perfil de una empresa importadora (URL-only; moderación admin)."""
    __tablename__ = "evidencias_importador"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    url = Column(String(500), nullable=False)
    estado = Column(String(20), nullable=False, default=EstadoEvidenciaImportador.pendiente.value)
    revisado_por_admin_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    nota_revision = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_revision = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<EvidenciaImportador(id={self.id}, estado={self.estado})>"
