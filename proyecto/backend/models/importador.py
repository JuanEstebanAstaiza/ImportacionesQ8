from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class EstadoImportador(str, enum.Enum):
    activo = "activo"
    inactivo = "inactivo"

class Importador(Base):
    __tablename__ = "importadores"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    nombre_empresa = Column(String(255), nullable=False)
    logo_url = Column(String(500), nullable=True)
    especialidad_producto = Column(JSON, nullable=True)  # ["Textiles", "Electrónica"]
    paises_origen = Column(JSON, nullable=True)  # ["China", "Vietnam"]
    calificacion_promedio = Column(Float, default=0.0)
    tiempo_respuesta_promedio = Column(String(10), nullable=False)  # "24h"
    capacidad_volumen = Column(Integer, nullable=True)
    estado = Column(String(20), default="activo")  # Usar String en lugar de Enum para compatibilidad con SQLite
    # Empresas que optan por un formulario de cotización propio (campos personalizados)
    # quedan fuera del motor de matching de cotizaciones abiertas: solo pueden recibir
    # cotizaciones dirigidas, ya que el formulario estándar es lo único compatible con
    # la difusión simultánea a varios importadores.
    solo_cotizaciones_directas = Column(Boolean, default=False, nullable=False)
    # Badge real de "socio verificado" (Semana 4 - Fase 6), independiente de
    # `estado`: una empresa puede estar activa sin estar verificada. Solo el
    # admin puede fijarlo (`POST /admin/importadores/{id}/verificar`).
    verificado = Column(Boolean, default=False, nullable=False)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Importador(id={self.id}, nombre_empresa={self.nombre_empresa}, estado={self.estado})>"