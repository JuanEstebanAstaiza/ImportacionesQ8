from sqlalchemy import Column, String, Boolean, DateTime
from uuid import uuid4
from datetime import datetime
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False)  # "solicitante", "importador", "admin"
    perfil_completo = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Usuario(id={self.id}, email={self.email}, rol={self.rol})>"