from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UsuarioAdminResponse(BaseModel):
    id: str
    email: str
    rol: str
    tier: str = "Bronze"
    tier_manual: bool = False
    puntos_cotizacion: int = 0
    importador_id: Optional[str] = None
    nombre: Optional[str] = None
    activo: bool
    perfil_completo: bool
    fecha_creacion: datetime

    model_config = {"from_attributes": True}

class UsuarioEstadoUpdate(BaseModel):
    activo: bool


class EnvioCorreoMasivoRequest(BaseModel):
    """Contenido y destinatarios de una campaña iniciada por administración."""

    asunto: str = Field(..., min_length=3, max_length=180)
    cuerpo: str = Field(..., min_length=1, max_length=20_000)
    roles: List[str] = Field(default_factory=list, max_length=5)
    usuarios_ids: List[str] = Field(default_factory=list, max_length=500)
    correos: List[EmailStr] = Field(default_factory=list, max_length=500)


class EnvioCorreoMasivoResponse(BaseModel):
    destinatarios: int
    enviados: int
    fallidos: int
    fallos: List[str] = Field(default_factory=list)

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


class CrearAgenteSoporteRequest(BaseModel):
    """Alta de una cuenta del equipo de atención al cliente."""
    email: EmailStr
    password: str = Field(..., min_length=9, max_length=128)
    nombre: str = Field(..., min_length=2, max_length=255)
    telefono: Optional[str] = Field(None, max_length=30)
    # Nivel de la mesa. 1 atiende lo corriente; 3, lo que requiere experiencia.
    nivel: int = Field(1, ge=1, le=3)


class CrearDisenadorRequest(BaseModel):
    """Alta de un designer de Zarpi (portadas de Tendencias)."""
    email: EmailStr
    password: str = Field(..., min_length=9, max_length=128)
    nombre: str = Field(..., min_length=2, max_length=255)
    telefono: Optional[str] = Field(None, max_length=30)


class DisenadorItem(BaseModel):
    id: str
    email: str
    nombre: Optional[str] = None
    activo: bool
    publicados: int = 0
    fecha_creacion: Optional[datetime] = None


class RequisitoVerificacion(BaseModel):
    """Un punto comprobable del expediente de una empresa."""
    clave: str
    titulo: str
    detalle: str
    cumple: bool
    valor: str


class ExpedienteVerificacion(BaseModel):
    """Qué cumple y qué le falta a una empresa para llevar el sello."""
    importador_id: str
    nombre_empresa: str
    verificado: bool
    estado: str
    obligatorios: List[RequisitoVerificacion]
    recomendables: List[RequisitoVerificacion]
    obligatorios_cumplidos: int
    obligatorios_totales: int
    recomendables_cumplidos: int
    recomendables_totales: int
    listo_para_verificar: bool
    pendientes: List[str]


class RetirarVerificacionRequest(BaseModel):
    """Motivo por el que se retira el sello. Queda escrito."""
    motivo: str = Field(..., min_length=5, max_length=500)


class NivelAgenteRequest(BaseModel):
    """Cambio de nivel de un agente ya existente."""
    nivel: int = Field(..., ge=1, le=3)


class AgenteSoporteItem(BaseModel):
    """Ficha de un agente con su desempeño, para el panel."""
    id: str
    email: str
    nombre: Optional[str] = None
    activo: bool
    nivel: Optional[int] = None
    tickets_asignados: int = 0
    tickets_cerrados: int = 0
    calificaciones_recibidas: int = 0
    calificacion_promedio: Optional[float] = None


class MensajeSoporteRequest(BaseModel):
    """Intervención del equipo de la plataforma en una conversación."""
    contenido: str = Field(..., min_length=1, max_length=2000)


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


class CotizanteAdminResponse(BaseModel):
    id: str
    email: str
    nombre: Optional[str] = None
    tier: str
    tier_manual: bool
    puntos_cotizacion: int
    fecha_creacion: datetime


class TierUpdateRequest(BaseModel):
    tier: str


class RecalculoTiersResponse(BaseModel):
    evaluados: int
    actualizados: int


class UmbralTierResponse(BaseModel):
    tier: str
    minimo_cotizaciones: int
    minimo_ordenes: int
    minimo_valor_operaciones_usd: float

    model_config = {"from_attributes": True}


class UmbralesTierUpdateRequest(BaseModel):
    umbrales: List[UmbralTierResponse]


class PuntosCotizacionUpdateRequest(BaseModel):
    delta: int = Field(..., ne=0)
    tipo: str = Field(default="recarga", pattern="^(recarga|ajuste)$")
    descripcion: Optional[str] = Field(None, max_length=500)


class MovimientoPuntoCotizacionResponse(BaseModel):
    id: str
    usuario_id: str
    admin_id: Optional[str] = None
    cotizacion_id: Optional[str] = None
    tipo: str
    delta: int
    saldo_resultante: int
    descripcion: Optional[str] = None
    fecha: datetime

    model_config = {"from_attributes": True}


# ==================== Restaurar copia de seguridad desde el panel ====================

class TablaBackupComparada(BaseModel):
    tabla: str
    en_backup: int
    actual: Optional[int] = None  # None: la tabla no existe en el esquema actual


class BackupSubidoResponse(BaseModel):
    """Vista previa de un ZIP subido, antes de restaurarlo."""
    subida_id: str
    nombre_original: str
    tamano_bytes: int
    generado_en: Optional[str] = None
    revision_alembic: Optional[str] = None
    revision_actual: Optional[str] = None
    incluye_archivos: bool
    archivos: int
    total_filas_backup: int
    total_filas_actual: int
    tablas: List[TablaBackupComparada]
    advertencias: List[str] = []


class RestaurarBackupRequest(BaseModel):
    # Hay que escribirlo a mano: es la única barrera ante un clic accidental
    # sobre una acción que reemplaza todos los datos de la plataforma.
    confirmacion: str = Field(..., description='Debe ser exactamente "RESTAURAR"')
    incluir_archivos: bool = True


class RestaurarBackupResponse(BaseModel):
    tablas_restauradas: int
    filas_restauradas: int
    archivos_restaurados: int
    tablas_desconocidas: List[str] = []
    cotizaciones_abiertas_reindexadas: int
    backup_previo: Optional[str] = None
    # False si la cuenta que restauró ya no existe (o no es admin) en los datos
    # restaurados: el panel debe mandar a iniciar sesión de nuevo.
    sesion_vigente: bool
