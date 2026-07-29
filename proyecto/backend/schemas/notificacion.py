from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Any, Dict, List
from datetime import datetime


class NotificacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    usuario_id: str
    tipo: str
    titulo: str
    mensaje: str
    data: Optional[Dict[str, Any]] = None
    leida: bool
    fecha_creacion: datetime
    fecha_lectura: Optional[datetime] = None


class NotificacionesListaResponse(BaseModel):
    items: List[NotificacionResponse]
    total: int
    no_leidas: int


class MarcarLeidasResponse(BaseModel):
    actualizadas: int
    mensaje: str = "Notificaciones marcadas como leídas"
