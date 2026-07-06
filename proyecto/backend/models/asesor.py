from sqlalchemy import Column, String, DateTime
from uuid import uuid4
from datetime import datetime
from database import Base

class Asesor(Base):
    __tablename__ = "asesores"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    importador_id = Column(String(36), nullable=False)
    nombre = Column(String(255), nullable=False)
    foto_url = Column(String(500), nullable=True)
    whatsapp = Column(String(20), nullable=False)

    def __repr__(self):
        return f"<Asesor(id={self.id}, nombre={self.nombre})>"