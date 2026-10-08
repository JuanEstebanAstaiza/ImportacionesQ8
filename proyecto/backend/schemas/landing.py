from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


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
    fuente: str = "texto"
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
    fuente: str = Field("texto", min_length=2, max_length=20)
    orden: int = Field(100, ge=0, le=10000)
    activo: bool = True

    @field_validator("fuente")
    @classmethod
    def fuente_conocida(cls, v: str) -> str:
        from models.landing import FUENTES_BLOQUE_LANDING

        v = v.strip().lower()
        if v not in FUENTES_BLOQUE_LANDING:
            raise ValueError(f"fuente debe ser una de: {', '.join(FUENTES_BLOQUE_LANDING)}")
        return v


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


MAX_VIDEOS_ROTATIVOS = 10
PREFIJO_ARCHIVO = "/documentos/archivos/"


class VideoRotativo(BaseModel):
    """Un video del carrusel en sus dos encuadres. Basta con uno: si solo hay
    horizontal o solo vertical, ese se muestra en todas las pantallas."""
    id: Optional[str] = Field(None, max_length=60)
    titulo: Optional[str] = Field(None, max_length=120)
    horizontal: Optional[str] = Field(None, max_length=500)
    vertical: Optional[str] = Field(None, max_length=500)

    @field_validator("titulo", "horizontal", "vertical")
    @classmethod
    def vacio_es_nulo(cls, v: Optional[str]) -> Optional[str]:
        v = (v or "").strip()
        return v or None

    @field_validator("horizontal", "vertical")
    @classmethod
    def solo_archivos_subidos(cls, v: Optional[str]) -> Optional[str]:
        # Solo archivos de gestión documental: así quedan públicos por la regla
        # de recursos de la Landing y no se cuelan URLs de terceros.
        if v is not None and not v.startswith(PREFIJO_ARCHIVO):
            raise ValueError("El video debe subirse o elegirse desde Documentos")
        return v

    @model_validator(mode="after")
    def al_menos_un_encuadre(self):
        if not self.horizontal and not self.vertical:
            raise ValueError("Cada video necesita al menos la versión horizontal o la vertical")
        return self


class VideosQuienesSomos(BaseModel):
    """Carrusel de videos de la sección "Quiénes somos"."""
    activo: bool = True
    # Cada cuántos segundos pasa al siguiente video (si no termina antes).
    intervalo_segundos: int = Field(20, ge=5, le=300)
    videos: List[VideoRotativo] = Field(default_factory=list, max_length=MAX_VIDEOS_ROTATIVOS)


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
