from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UsuarioMeResponse(BaseModel):
    id: str
    email: str
    rol: str
    importador_id: Optional[str] = None
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    foto_url: Optional[str] = None
    whatsapp: Optional[str] = None
    activo: bool
    perfil_completo: bool
    fecha_creacion: datetime

    model_config = {"from_attributes": True}

class UsuarioMeUpdate(BaseModel):
    """Personalización del perfil personal (cliente solicitante, dueño o asesor)."""
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    foto_url: Optional[str] = None
    whatsapp: Optional[str] = None

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

class CotizacionPoolItem(BaseModel):
    """Item del pool de cotizaciones sin reclamar de la empresa."""
    id: str
    solicitante_id: str
    modalidad: str
    nombre_producto: str
    descripcion_cliente: str
    cantidad_minima: int
    precio_objetivo_usd: Optional[float] = None
    incoterm: str
    estado: str
    fecha_creacion: str

class CotizacionAsignadaItem(CotizacionPoolItem):
    asesor_asignado_id: Optional[str] = None
