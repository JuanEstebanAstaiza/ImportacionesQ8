from sqlalchemy import Column, String, Text, DateTime, UniqueConstraint
from uuid import uuid4
from datetime import datetime
from database import Base


class TraduccionCache(Base):
    """Caché de traducciones para no re-llamar a Google Translation."""
    __tablename__ = "traducciones_cache"
    __table_args__ = (
        UniqueConstraint(
            "hash_texto", "idioma_origen", "idioma_destino",
            name="unique_traduccion_cache"
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    hash_texto = Column(String(64), nullable=False, index=True)
    idioma_origen = Column(String(16), nullable=False)
    idioma_destino = Column(String(16), nullable=False)
    texto_traducido = Column(Text, nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow)
