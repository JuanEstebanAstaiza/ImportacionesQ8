from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UsuarioMeResponse(BaseModel):
    id: str
    email: str
    rol: str
    tier: str = "Bronze"
    puntos_cotizacion: int = 0
    importaciones_fuera_plataforma: int = 0
    importador_id: Optional[str] = None
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    foto_url: Optional[str] = None
    whatsapp: Optional[str] = None
    activo: bool
    perfil_completo: bool
    fecha_creacion: datetime
    # Curador de Tendencias (capacidad aparte del rol).
    es_curador: bool = False

    model_config = {"from_attributes": True}

class UsuarioMeUpdate(BaseModel):
    """Personalización del perfil personal (cliente solicitante, dueño o asesor)."""
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    foto_url: Optional[str] = None
    whatsapp: Optional[str] = None
    # Solo tiene sentido para el cotizante: alimenta su perfil público.
    importaciones_fuera_plataforma: Optional[int] = Field(None, ge=0, le=100_000)

class AsesorCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=9)
    nombre: Optional[str] = None
    telefono: Optional[str] = None

class AsesorResponse(BaseModel):
    id: str
    email: str
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    activo: bool
    fecha_creacion: datetime

    model_config = {"from_attributes": True}

class AsesorEstadoUpdate(BaseModel):
    activo: bool

class AsignarAsesorRequest(BaseModel):
    """Reasignación explícita del responsable de una cotización.

    `asesor_id = None` devuelve la cotización al pool de la empresa.
    """
    asesor_id: Optional[str] = None

class ReasignacionResponse(BaseModel):
    cotizaciones_reasignadas: int = 0
    ordenes_reasignadas: int = 0
    conversaciones_reasignadas: int = 0

class AsesorEstadoResponse(AsesorResponse):
    """Estado del asesor + qué se movió al desactivarlo.

    Extiende `AsesorResponse` en vez de envolverlo para no romper a los clientes
    que ya leen `activo`/`id` en la raíz de la respuesta.
    """
    cotizaciones_reasignadas: int = 0
    ordenes_reasignadas: int = 0
    conversaciones_reasignadas: int = 0

class CotizacionPoolItem(BaseModel):
    """Item del pool de cotizaciones sin reclamar de la empresa."""
    id: str
    solicitante_id: str
    modalidad: str
    nombre_producto: str
    descripcion_cliente: str
    cantidad_minima: float
    precio_objetivo_usd: Optional[float] = None
    incoterm: str
    estado: str
    fecha_creacion: str

class CotizacionAsignadaItem(CotizacionPoolItem):
    asesor_asignado_id: Optional[str] = None
