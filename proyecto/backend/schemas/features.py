from pydantic import BaseModel, Field, EmailStr, field_validator

from utils.urls import canonicalize_resource_url
from typing import Optional, List, Literal
from datetime import datetime


class OrganizacionResponse(BaseModel):
    id: str
    razon_social: str
    nit: str
    creditos_balance: float
    owner_usuario_id: str
    activo: bool

    model_config = {"from_attributes": True}


class MiembroResponse(BaseModel):
    id: str
    organizacion_id: str
    usuario_id: str
    email: Optional[str] = None
    nombre: Optional[str] = None
    rol_org: str
    activo: bool

    model_config = {"from_attributes": True}


class InvitarMiembroRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=9)
    nombre: Optional[str] = None
    rol_org: Literal["admin", "member"] = "member"


class ActualizarMiembroRequest(BaseModel):
    rol_org: Optional[Literal["admin", "member"]] = None
    activo: Optional[bool] = None


class EvidenciaImportadorCreate(BaseModel):
    tipo: Literal[
        "certificado", "foto_fabrica", "catalogo", "moq_doc",
        "video_presentacion", "foto_producto", "otro",
    ]
    titulo: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = Field(
        None,
        max_length=600,
        description="Descripcion breve que acompana al video o a la foto en la ficha publica",
    )
    url: str = Field(..., min_length=5, max_length=500)

    @field_validator("url")
    @classmethod
    def url_normalizada(cls, v: str) -> str:
        """Se guarda la ruta canonica del backend, no la URL absoluta del host
        donde se subio: si no, la evidencia dejaba de resolver desde otro
        entorno (Dev Tunnel, produccion). Misma regla que el logo o el banner."""
        return canonicalize_resource_url(v, campo="url")


class EvidenciaImportadorResponse(BaseModel):
    id: str
    importador_id: str
    tipo: str
    titulo: str
    descripcion: Optional[str]
    url: str
    estado: str
    nota_revision: Optional[str] = None
    fecha_creacion: Optional[datetime] = None
    fecha_revision: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RevisarEvidenciaRequest(BaseModel):
    estado: Literal["aprobada", "rechazada"]
    nota_revision: Optional[str] = None


class DisputaResponse(BaseModel):
    id: str
    orden_id: str
    abierta_por_usuario_id: str
    estado: str
    motivo: str
    resolucion_admin: Optional[str] = None
    fecha_apertura: Optional[datetime] = None
    fecha_resolucion: Optional[datetime] = None
    evidencias: List["EvidenciaDisputaResponse"] = []
    mensajes: List["MensajeDisputaResponse"] = []

    model_config = {"from_attributes": True}


class EvidenciaDisputaCreate(BaseModel):
    url: str = Field(..., min_length=5, max_length=500)
    tipo: Literal["imagen", "documento", "otro"] = "documento"
    descripcion: Optional[str] = None


class EvidenciaDisputaResponse(BaseModel):
    id: str
    disputa_id: str
    subido_por_usuario_id: str
    url: str
    tipo: str
    descripcion: Optional[str]
    fecha: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MensajeDisputaCreate(BaseModel):
    contenido: str = Field(..., min_length=1)


class MensajeDisputaResponse(BaseModel):
    id: str
    disputa_id: str
    autor_id: str
    contenido: str
    tipo: str
    fecha: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ResolverDisputaRoomRequest(BaseModel):
    resolucion: str = Field(..., min_length=5)
    estado: Literal["resuelta", "cerrada"] = "resuelta"


class CodigoReferidoResponse(BaseModel):
    codigo: str
    activo: bool


class EstadisticasReferidoResponse(BaseModel):
    codigo: str
    usos: int
    creditos_ganados: float


class TraducirRequest(BaseModel):
    texto: Optional[str] = None
    idioma_destino: Literal["es", "en", "zh-CN"]


class TraducirResponse(BaseModel):
    original: str
    traducido: str
    idioma_origen_detectado: str
    idioma_destino: str


DisputaResponse.model_rebuild()
