from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MensajeChatCreate(BaseModel):
    contenido: str = Field(..., min_length=1)
    tipo: str = "texto"  # "texto" o "archivo"

class MensajeChatResponse(BaseModel):
    id: str
    conversacion_id: str
    remitente_id: str
    contenido: str
    tipo: str
    fecha_envio: datetime

    model_config = {"from_attributes": True}

class ConversacionChatResponse(BaseModel):
    id: str
    cotizacion_id: str
    orden_id: Optional[str] = None
    solicitante_id: str
    importador_usuario_id: str
    fecha_creacion: datetime
    ultimo_mensaje: Optional[MensajeChatResponse] = None

    model_config = {"from_attributes": True}
