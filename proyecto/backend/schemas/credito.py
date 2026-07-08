from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class SolicitarRecreacionRequest(BaseModel):
    motivo: str = Field(..., min_length=10, description="Explicación de qué salió mal en la negociación")
    parte_atribuida_sugerida: Literal["solicitante", "importador"]

class SolicitudRecreacionResponse(BaseModel):
    id: str
    cotizacion_origen_id: str
    solicitado_por_usuario_id: str
    motivo: str
    parte_atribuida_sugerida: str
    estado: str
    parte_atribuida_final: Optional[str]
    fecha_creacion: datetime
    fecha_resolucion: Optional[datetime]

    model_config = {"from_attributes": True}

class ResolverRecreacionRequest(BaseModel):
    parte_atribuida_final: Literal["solicitante", "importador"]
    aprobado: bool = Field(..., description="Si es False, se rechaza la solicitud y la cotización original no se cancela")
