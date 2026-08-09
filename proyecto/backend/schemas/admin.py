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

class ConversacionAdminItem(BaseModel):
    """Fila del supervisor de chats del panel de administración."""
    id: str
    # "negociacion" (solicitante ↔ empresa) o "interna" (empresa ↔ su asesor).
    # Las internas no cuelgan de una cotización ni tienen solicitante.
    tipo: str = "negociacion"
    cotizacion_id: Optional[str] = None
    orden_id: Optional[str] = None
    fecha_creacion: datetime

    solicitante_id: Optional[str] = None
    solicitante_nombre: Optional[str] = None
    solicitante_email: Optional[str] = None

    importador_usuario_id: str
    importador_usuario_nombre: Optional[str] = None
    importador_usuario_email: Optional[str] = None
    importador_id: Optional[str] = None
    empresa_nombre: Optional[str] = None

    total_mensajes: int = 0
    ultimo_mensaje_texto: Optional[str] = None
    ultimo_mensaje_fecha: Optional[datetime] = None


class ConversacionesAdminResponse(BaseModel):
    items: List[ConversacionAdminItem]
    total: int
    limit: int
    offset: int


class MensajeAdminItem(BaseModel):
    id: str
    conversacion_id: str
    remitente_id: str
    remitente_nombre: Optional[str] = None
    remitente_email: Optional[str] = None
    remitente_rol: Optional[str] = None
    contenido: str
    tipo: str
    fecha_envio: datetime


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
