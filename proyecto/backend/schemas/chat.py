from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime


class MensajeChatCreate(BaseModel):
    # Tope anti-DoS / flood de payloads enormes por mensaje
    contenido: str = Field(..., min_length=1, max_length=4000)
    # "sistema" solo lo genera el backend; el cliente no puede forjarlo
    tipo: str = Field(default="texto", pattern="^(texto|archivo)$")
    metadata: Optional[Dict[str, Any]] = None


class MensajeChatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversacion_id: str
    remitente_id: str
    contenido: str
    tipo: str
    fecha_envio: datetime
    # No usar from_attributes sobre "metadata": en SQLAlchemy es MetaData del registry.
    metadata: Optional[Dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def _desde_orm_o_dict(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": str(data.id),
            "conversacion_id": data.conversacion_id,
            "remitente_id": data.remitente_id,
            "contenido": data.contenido,
            "tipo": data.tipo,
            "fecha_envio": data.fecha_envio,
            "metadata": getattr(data, "metadata_json", None),
        }


class ConversacionChatResponse(BaseModel):
    id: str
    # "negociacion" (solicitante ↔ empresa) o "interna" (empresa ↔ su asesor).
    # En las internas no hay cotización ni solicitante, de ahí los opcionales.
    tipo: str = "negociacion"
    cotizacion_id: Optional[str] = None
    orden_id: Optional[str] = None
    solicitante_id: Optional[str] = None
    importador_usuario_id: str
    importador_id: Optional[str] = None
    # Con quién se habla, ya resuelto por el backend: el frontend no tiene forma
    # de traducir un id de usuario a un nombre sin pedir el directorio entero.
    contraparte_nombre: Optional[str] = None
    fecha_creacion: datetime
    ultimo_mensaje: Optional[MensajeChatResponse] = None

    model_config = ConfigDict(from_attributes=True)


class IniciarChatInternoRequest(BaseModel):
    """Abre (o reutiliza) el canal de coordinación entre la empresa y un asesor.

    Lo puede pedir la cuenta dueña indicando `asesor_id`, o el propio asesor sin
    indicar nada (abre el suyo con su empresa).
    """
    asesor_id: Optional[str] = None
    mensaje_inicial: Optional[str] = Field(None, max_length=2000)


class IniciarChatRequest(BaseModel):
    """Abre (o reutiliza) la conversación de negociación desde el lado de la empresa.

    El asesor/dueño puede iniciar el chat al enviar la propuesta, sin esperar
    a que el solicitante acepte o invoque PUT .../propuestas/aceptar.
    """
    cotizacion_id: Optional[str] = None
    propuesta_id: Optional[str] = None
    mensaje_inicial: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def requiere_referencia(self):
        if not self.cotizacion_id and not self.propuesta_id:
            raise ValueError("Debes indicar cotizacion_id o propuesta_id")
        return self
