from pydantic import BaseModel
from typing import Optional


class MetricasImportadorResponse(BaseModel):
    """Resumen comercial de la empresa importadora (panel dueño)."""
    importador_id: str
    total_cotizaciones_recibidas: int
    total_propuestas_enviadas: int
    total_propuestas_aceptadas: int
    tasa_aceptacion_pct: float
    volumen_cotizado_usd: float
    ordenes_activas: int
    ordenes_totales: int
    asesores_activos: int
    tiempo_promedio_respuesta_horas: Optional[float] = None


class MetricasAsesorResponse(BaseModel):
    """Rendimiento del asesor autenticado (dashboard personal)."""
    asesor_id: str
    cotizaciones_asignadas: int
    cotizaciones_respondidas: int
    propuestas_enviadas: int
    propuestas_aceptadas: int
    tasa_aceptacion_pct: float
    volumen_cotizado_usd: float
    ordenes_asociadas: int
