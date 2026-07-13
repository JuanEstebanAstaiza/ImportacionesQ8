from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UsuarioAdminResponse(BaseModel):
    id: str
    email: str
    rol: str
    importador_id: Optional[str] = None
    nombre: Optional[str] = None
    activo: bool
    perfil_completo: bool
    fecha_creacion: datetime

    model_config = {"from_attributes": True}

class UsuarioEstadoUpdate(BaseModel):
    activo: bool

class DisputaOrdenResponse(BaseModel):
    id: str
    cotizacion_id: str
    importador_id: str
    solicitante_id: str
    estado: str
    motivo_disputa: Optional[str] = None
    fecha_actualizacion: datetime

    model_config = {"from_attributes": True}

class MetricasResponse(BaseModel):
    """Métricas de éxito de la plataforma (sección "Métricas de éxito" del PDF)."""
    total_cotizaciones: int
    cotizaciones_dirigidas: int
    cotizaciones_abiertas: int
    tasa_respuesta_abiertas: float  # % de cotizaciones abiertas que recibieron al menos 1 propuesta
    tiempo_promedio_primera_propuesta_horas: Optional[float] = None
    tasa_conversion_a_orden: float  # % de cotizaciones con propuesta aceptada que llegaron a pagarse
    importadores_activos: int
    importadores_verificados: int
    ordenes_en_disputa: int
