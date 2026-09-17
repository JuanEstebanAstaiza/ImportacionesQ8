from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LandingBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    seccion: str
    tipo: str
    contenido: Optional[str] = None
    alineacion: str = "left"
    tamano_fuente: str = "md"
    accion_boton: Optional[str] = None
    accion_url: Optional[str] = None
    token_color: str = "foreground"
    fuente: str = "avenor"
    orden: int = 100
    activo: bool = True


class LandingBlockUpsert(BaseModel):
    """Un bloque tal como lo envía el editor. `id` ausente/desconocido = nuevo."""
    id: Optional[str] = None
    seccion: str = Field("home", min_length=2, max_length=30)
    tipo: str = Field(..., min_length=2, max_length=20)
    contenido: Optional[str] = Field(None, max_length=20000)
    alineacion: str = Field("left", min_length=2, max_length=10)
    tamano_fuente: str = Field("md", min_length=1, max_length=10)
    accion_boton: Optional[str] = Field(None, max_length=20)
    accion_url: Optional[str] = Field(None, max_length=500)
    token_color: str = Field("foreground", min_length=2, max_length=20)
    fuente: str = Field("avenor", min_length=2, max_length=20)
    orden: int = Field(100, ge=0, le=10000)
    activo: bool = True


class LandingBlocksSaveRequest(BaseModel):
    """Reemplaza la estructura completa de bloques de la Landing."""
    blocks: List[LandingBlockUpsert] = Field(default_factory=list)


class LandingAllyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nombre: str
    logo_url: Optional[str] = None
    categoria: Optional[str] = None
    enlace: Optional[str] = None
    orden: int = 100
    activo: bool = True


class LandingAllyCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150)
    logo_url: Optional[str] = Field(None, max_length=500)
    categoria: Optional[str] = Field(None, max_length=80)
    enlace: Optional[str] = Field(None, max_length=500)
    orden: int = Field(100, ge=0, le=10000)
    activo: bool = True


class LandingAllyUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    logo_url: Optional[str] = Field(None, max_length=500)
    categoria: Optional[str] = Field(None, max_length=80)
    enlace: Optional[str] = Field(None, max_length=500)
    orden: Optional[int] = Field(None, ge=0, le=10000)
    activo: Optional[bool] = None


class LandingNewsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    resumen: str
    contenido: Optional[str] = None
    imagen_url: Optional[str] = None
    fecha_publicacion: Optional[datetime] = None
    orden: int = 100
    activo: bool = True


class LandingNewsCreate(BaseModel):
    titulo: str = Field(..., min_length=2, max_length=200)
    resumen: str = Field(..., min_length=2, max_length=400)
    contenido: Optional[str] = Field(None, max_length=20000)
    imagen_url: Optional[str] = Field(None, max_length=500)
    orden: int = Field(100, ge=0, le=10000)
    activo: bool = True


class LandingNewsUpdate(BaseModel):
    titulo: Optional[str] = Field(None, min_length=2, max_length=200)
    resumen: Optional[str] = Field(None, min_length=2, max_length=400)
    contenido: Optional[str] = Field(None, max_length=20000)
    imagen_url: Optional[str] = Field(None, max_length=500)
    orden: Optional[int] = Field(None, ge=0, le=10000)
    activo: Optional[bool] = None


class LandingDynamicContentResponse(BaseModel):
    """Lo que necesita la vista pública en una sola llamada."""
    blocks: List[LandingBlockResponse]
    allies: List[LandingAllyResponse]
    news: List[LandingNewsResponse]


class ContactoRequest(BaseModel):
    """Formulario de contacto público de la Landing (sección 'Contacto')."""
    nombre: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    telefono: Optional[str] = Field(None, max_length=40)
    perfil: str = Field("comprador", pattern="^(comprador|nacionalizadora)$")
    mensaje: str = Field(..., min_length=5, max_length=4000)


class ContactoResponse(BaseModel):
    enviado: bool
    mensaje: str
