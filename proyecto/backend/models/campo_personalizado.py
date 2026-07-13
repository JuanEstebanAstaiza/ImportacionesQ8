from sqlalchemy import Column, String, Integer, Boolean, JSON, ForeignKey
from uuid import uuid4
import enum
from database import Base

class TipoCampoPersonalizado(str, enum.Enum):
    texto = "texto"
    numero = "numero"
    select = "select"
    booleano = "booleano"

class CampoPersonalizado(Base):
    """Campo extra definido por una empresa importadora con solo_cotizaciones_directas=True
    para su propio formulario de cotización (además de los campos estándar del PDF)."""
    __tablename__ = "campos_personalizados"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False)
    etiqueta = Column(String(255), nullable=False)
    tipo = Column(String(20), nullable=False)  # "texto", "numero", "select", "booleano"
    opciones = Column(JSON, nullable=True)  # Solo para tipo "select": ["Opción 1", "Opción 2"]
    obligatorio = Column(Boolean, default=False, nullable=False)
    orden = Column(Integer, default=0, nullable=False)

    def __repr__(self):
        return f"<CampoPersonalizado(id={self.id}, importador_id={self.importador_id}, etiqueta={self.etiqueta})>"
