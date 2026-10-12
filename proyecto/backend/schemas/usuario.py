from pydantic import BaseModel, EmailStr, Field, field_validator
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
    apellido: Optional[str] = None
    indicativo_pais_telefono: Optional[str] = None
    telefono: Optional[str] = None
    foto_url: Optional[str] = None
    whatsapp: Optional[str] = None
    # Datos del registro: se muestran en el perfil pero no se editan desde ahí.
    tipo_persona: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    nit: Optional[str] = None
    razon_social: Optional[str] = None
    activo: bool
    perfil_completo: bool
    fecha_creacion: datetime
    # Curador de Tendencias (capacidad aparte del rol): aprueba las fichas.
    es_curador: bool = False
    cotizaciones_gratis: int = 0

    model_config = {"from_attributes": True}

class UsuarioMeUpdate(BaseModel):
    """Perfil personal de cualquier cuenta (cliente, dueño o asesor de empresa,
    admin). Documento, NIT y razón social no se cambian desde aquí: son los
    datos con los que se verificó la cuenta."""
    nombre: Optional[str] = Field(None, max_length=120)
    apellido: Optional[str] = Field(None, max_length=120)
    indicativo_pais_telefono: Optional[str] = Field(None, pattern=r"^\+\d{1,4}$")
    telefono: Optional[str] = Field(None, max_length=30, pattern=r"^[0-9 ()+-]*$")
    # Vacío la quita. Una imagen subida a la plataforma por la misma cuenta, o
    # una URL https (compatibilidad con perfiles anteriores).
    foto_url: Optional[str] = Field(None, max_length=500)
    whatsapp: Optional[str] = Field(None, max_length=20, pattern=r"^[0-9 ()+-]*$")
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


class CambioContrasena(BaseModel):
    actual: str = Field(..., min_length=1, max_length=200)
    nueva: str = Field(..., min_length=9, max_length=200)

    @field_validator("nueva")
    @classmethod
    def validar_nueva(cls, v: str) -> str:
        from utils.password_policy import password_cumple_politica

        if not password_cumple_politica(v):
            raise ValueError("La contraseña debe tener al menos 9 caracteres, una letra y un dígito")
        return v
