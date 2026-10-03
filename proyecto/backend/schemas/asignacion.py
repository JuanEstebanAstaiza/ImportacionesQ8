from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ConfiguracionAsignacion(BaseModel):
    modo: Literal["manual", "automatica"]
    cupo_por_solicitud: int


class ActualizarAsignacionRequest(BaseModel):
    modo: Optional[Literal["manual", "automatica"]] = None
    cupo_por_solicitud: Optional[int] = Field(None, ge=1, le=20, description="Máximo de empresas por solicitud")


class EstadoTrm(BaseModel):
    valor: float
    fuente: str
    vigencia: Optional[str] = None
    fecha_consulta: Optional[str] = None
    consulta_automatica: bool
    respaldo_admin: Optional[float] = None
    ultima_oficial: Optional[float] = None
    ultima_oficial_vigencia: Optional[str] = None
    ultima_oficial_consulta: Optional[str] = None
    valor_por_defecto: float


class ActualizarTrmRequest(BaseModel):
    respaldo: Optional[float] = Field(
        None, ge=500, le=50000,
        description="TRM de respaldo (COP por USD) para cuando falla la consulta oficial. null la quita.",
    )


class ConfiguracionOperacionResponse(BaseModel):
    asignacion: ConfiguracionAsignacion
    trm: EstadoTrm


class AsignacionResumen(BaseModel):
    importador_id: str
    nombre_empresa: str
    origen: Optional[str] = None
    fecha_asignacion: Optional[datetime] = None
    estado_propuesta: Optional[str] = None


class SolicitudAbiertaAdmin(BaseModel):
    id: str
    nombre_producto: str
    linea_producto: str
    pais_importacion: str
    cantidad_minima: float
    unidad_cantidad: str
    precio_objetivo_usd: Optional[float] = None
    moneda_precio_objetivo: str
    tipo_calidad: str
    incoterm: str
    estado: str
    fecha_creacion: datetime
    horas_desde_creacion: float
    asignadas: int
    cupo_por_solicitud: int
    propuestas_enviadas: int
    empresas: List[AsignacionResumen]


class CriterioEncaje(BaseModel):
    cumple: Optional[bool] = None
    detalle: str


class EncajeCandidato(BaseModel):
    categoria: bool
    pais: bool
    pedido_minimo: CriterioEncaje
    capacidad: CriterioEncaje


class DesempenoCandidato(BaseModel):
    solicitudes_asignadas: int = 0
    propuestas_enviadas: int = 0
    propuestas_aceptadas: int = 0
    tasa_respuesta_pct: Optional[float] = None
    tasa_cierre_pct: Optional[float] = None
    pedidos_entregados: int = 0
    pedidos_activos: int = 0


class CandidatoAsignacion(BaseModel):
    importador_id: str
    nombre_empresa: str
    logo_url: Optional[str] = None
    verificado: bool
    especialidades: List[str] = []
    paises_origen: List[str] = []
    calificacion_promedio: float
    tiempo_respuesta_promedio: Optional[str] = None
    pedido_minimo: Optional[float] = None
    pedido_minimo_unidad: Optional[str] = None
    capacidad_volumen: Optional[int] = None
    limite_cotizaciones_diarias: Optional[int] = None
    recibidas_hoy: int
    cupo_diario_agotado: bool
    encaje: EncajeCandidato
    desempeno: DesempenoCandidato
    asignada: bool
    origen_asignacion: Optional[str] = None
    fecha_asignacion: Optional[datetime] = None
    estado_propuesta: Optional[str] = None
    puntaje: float


class CandidatosResponse(BaseModel):
    solicitud: SolicitudAbiertaAdmin
    candidatos: List[CandidatoAsignacion]


class AsignarRequest(BaseModel):
    importador_ids: List[str] = Field(..., min_length=1, max_length=20)
