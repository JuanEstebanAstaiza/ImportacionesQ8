from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


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


# ==================== Panel de la empresa (a partir de la bitácora de eventos) ====================


class PendienteResponder(BaseModel):
    cotizacion_id: str
    nombre_producto: str
    linea_producto: str
    modalidad: str
    cantidad: float
    unidad: str
    recibida: datetime
    horas_esperando: float
    # "a_tiempo" (< 24 h), "atencion" (24–48 h) o "urgente" (> 48 h)
    nivel: str
    con_borrador: bool = False


class PanelEmpresaResponse(BaseModel):
    """Panel comercial de la empresa importadora, en pesos colombianos.

    Las tasas son de cohorte: de las solicitudes recibidas en el periodo,
    cuántas respondió; de las propuestas enviadas en el periodo, cuántas
    terminaron en pedido.
    """
    importador_id: str
    desde: Optional[datetime] = None
    moneda: str = "COP"
    trm: float
    trm_fuente: str

    solicitudes_recibidas: int
    propuestas_enviadas: int
    propuestas_aceptadas: int
    propuestas_descartadas: int
    propuestas_esperando: int

    # Propuesta a pedido: aceptadas ÷ enviadas.
    conversion_pct: Optional[float] = None
    # "Cierras 1 de cada X propuestas".
    cierre_uno_de_cada: Optional[float] = None
    # Propuestas enviadas ÷ solicitudes recibidas.
    tasa_respuesta_pct: Optional[float] = None
    tiempo_promedio_respuesta_horas: Optional[float] = None

    valor_cerrado_cop: float = 0
    valor_promedio_cerrado_cop: Optional[float] = None
    valor_esperando_cop: float = 0

    # compra, embarque, transito, nacionalizacion, entrega
    pedidos_por_etapa: Dict[str, int]
    pedidos_entregados: int

    # precio, tiempo, condiciones, otro, sin_motivo
    motivos_perdida: Dict[str, int]

    pendientes_responder: List[PendienteResponder]
    total_pendientes_responder: int
