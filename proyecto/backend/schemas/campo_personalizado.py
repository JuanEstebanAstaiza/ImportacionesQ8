from pydantic import BaseModel, Field
from typing import List, Optional

class CampoPersonalizadoCreate(BaseModel):
    etiqueta: str = Field(..., min_length=1)
    tipo: str = Field(..., description="'texto', 'numero', 'select' o 'booleano'")
    opciones: Optional[List[str]] = None
    obligatorio: bool = False
    orden: int = 0

class CampoPersonalizadoUpdate(BaseModel):
    etiqueta: Optional[str] = None
    tipo: Optional[str] = None
    opciones: Optional[List[str]] = None
    obligatorio: Optional[bool] = None
    orden: Optional[int] = None

class CampoPersonalizadoResponse(BaseModel):
    id: str
    importador_id: str
    etiqueta: str
    tipo: str
    opciones: Optional[List[str]] = None
    obligatorio: bool
    orden: int

    model_config = {"from_attributes": True}

class FormularioImportadorResponse(BaseModel):
    """Indica al frontend si debe renderizar el formulario estándar (PDF) o uno
    personalizado antes de enviar POST /cotizaciones."""
    importador_id: str
    solo_cotizaciones_directas: bool
    campos_personalizados: List[CampoPersonalizadoResponse] = []
