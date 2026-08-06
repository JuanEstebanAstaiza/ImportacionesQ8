from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CarpetaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[str] = None


class CarpetaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=255)
    parent_id: Optional[str] = None


class ArchivoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    carpeta_id: Optional[str] = None
    mime_type: Optional[str] = None
    extension: Optional[str] = None
    size_bytes: Optional[int] = Field(default=None, ge=0)
    storage_url: Optional[str] = Field(default=None, max_length=500)
    origen: str = Field(default="manual", max_length=30)


class ArchivoUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=255)
    carpeta_id: Optional[str] = None


class EtiquetaCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, max_length=24)


class FavoritoToggle(BaseModel):
    recurso_tipo: str = Field(..., pattern="^(archivo|carpeta)$")
    recurso_id: str
    activo: bool = True


class ResourceTagAssign(BaseModel):
    etiqueta_ids: List[str] = Field(default_factory=list)


class CompartirRecursosChatRequest(BaseModel):
    conversacion_ids: List[str] = Field(..., min_length=1)
    archivo_ids: List[str] = Field(..., min_length=1)
    mensaje: Optional[str] = Field(default=None, max_length=2000)


class CarpetaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_user_id: str
    parent_id: Optional[str] = None
    nombre: str
    created_at: datetime
    updated_at: datetime


class EtiquetaItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_user_id: str
    nombre: str
    color: Optional[str] = None
    created_at: datetime


class ArchivoItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_user_id: str
    carpeta_id: Optional[str] = None
    nombre: str
    extension: str
    mime_type: str
    tipo_recurso: str
    size_bytes: Optional[int] = None
    storage_url: Optional[str] = None
    origen: str
    created_at: datetime
    updated_at: datetime
    favorito: bool = False
    etiquetas: List[EtiquetaItem] = Field(default_factory=list)


class ExplorerResponse(BaseModel):
    carpetas: List[CarpetaItem] = Field(default_factory=list)
    archivos: List[ArchivoItem] = Field(default_factory=list)


class ChatAttachmentItem(BaseModel):
    archivo_id: str
    mensaje_id: str
    conversacion_id: str
    nombre: str
    mime_type: str
    extension: str
    tipo_recurso: str
    size_bytes: Optional[int] = None
    storage_url: Optional[str] = None
    created_at: datetime
