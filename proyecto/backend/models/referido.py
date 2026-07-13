from sqlalchemy import Column, String, Float, DateTime, Boolean, ForeignKey, UniqueConstraint
from uuid import uuid4
from datetime import datetime
from database import Base


class CodigoReferido(Base):
    """Código de referido de un solicitante (quien cotiza). Importadoras no participan."""
    __tablename__ = "codigos_referido"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, unique=True, index=True)
    codigo = Column(String(32), nullable=False, unique=True, index=True)
    activo = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)


class ReferidoUso(Base):
    __tablename__ = "referidos_uso"
    __table_args__ = (
        UniqueConstraint("usuario_referido_id", name="unique_usuario_referido"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    codigo_id = Column(String(36), ForeignKey("codigos_referido.id"), nullable=False, index=True)
    usuario_referido_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    bono_referidor = Column(Float, nullable=False, default=0.0)
    bono_referido = Column(Float, nullable=False, default=0.0)
    fecha = Column(DateTime, default=datetime.utcnow)
