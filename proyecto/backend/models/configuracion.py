from sqlalchemy import Column, DateTime, String, Text
from datetime import datetime

from database import Base


class ConfiguracionPlataforma(Base):
    """Ajustes de operación que el admin cambia sin desplegar (clave → valor).

    Claves en uso (ver `services/configuracion.py`):
    - `asignacion.modo`: "manual" (el admin asigna cada abierta) o "automatica".
    - `asignacion.cupo_por_solicitud`: máximo de empresas por solicitud.
    - `trm.*`: última TRM oficial consultada y el valor de respaldo del admin.
    """
    __tablename__ = "configuracion_plataforma"

    clave = Column(String(80), primary_key=True)
    valor = Column(Text, nullable=True)
    actualizado_por = Column(String(36), nullable=True)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
