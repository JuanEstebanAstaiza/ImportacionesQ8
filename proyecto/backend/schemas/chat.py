from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List, Any, Dict, Literal
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
    # "negociacion" (solicitante ↔ empresa), "interna" (empresa ↔ su asesor) o
    # "soporte" (usuario ↔ equipo de la plataforma). Cada forma deja en nulo lo
    # que no le aplica, de ahí los opcionales.
    tipo: str = "negociacion"
    cotizacion_id: Optional[str] = None
    orden_id: Optional[str] = None
    solicitante_id: Optional[str] = None
    importador_usuario_id: Optional[str] = None
    importador_id: Optional[str] = None
    # Con quién se habla, ya resuelto por el backend: el frontend no tiene forma
    # de traducir un id de usuario a un nombre sin pedir el directorio entero.
    #
    # No basta con el nombre. La cabecera del chat mostraba siempre el mismo
    # rótulo genérico y las iniciales de la empresa, así que un asesor no podía
    # distinguir a un cliente de otro, y el equipo de soporte no sabía si le
    # escribía un solicitante o una importadora. Estos campos identifican a la
    # persona concreta y su papel en la conversación.
    contraparte_nombre: Optional[str] = None
    # Id del usuario con quien se habla: da un color de avatar estable, distinto
    # para cada interlocutor. Nulo cuando la contraparte no es una persona
    # (la plataforma, en un ticket de soporte visto por quien lo abrió).
    contraparte_id: Optional[str] = None
    # "solicitante", "asesor", "importador", "admin"/"soporte", o "plataforma".
    contraparte_rol: Optional[str] = None
    # Empresa a la que pertenece la contraparte, si pertenece a alguna. Deja ver
    # "Marcela Ríos · Control Textil S.A.S." en vez de solo un nombre suelto.
    contraparte_empresa: Optional[str] = None
    contraparte_foto_url: Optional[str] = None
    # Solo en los tickets de soporte.
    asunto: Optional[str] = None
    urgencia: Optional[str] = None
    # Rol de quien abrió el ticket, para que soporte sepa a quién atiende.
    solicitante_rol: Optional[str] = None
    # Mensajes posteriores a la última lectura de quien consulta.
    no_leidos: int = 0
    # Cierre del ticket: qué se hizo, quién lo cerró y cuándo.
    cerrada: bool = False
    resolucion: Optional[str] = None
    cerrada_por_nombre: Optional[str] = None
    fecha_cierre: Optional[datetime] = None
    # Mesa de soporte: nivel del caso y agente que lo atiende.
    nivel: Optional[int] = None
    agente_asignado_id: Optional[str] = None
    agente_nombre: Optional[str] = None
    agente_nivel: Optional[int] = None
    # Calificación del servicio, si quien pidió ayuda ya puntuó.
    calificacion: Optional[int] = None
    comentario_calificacion: Optional[str] = None
    fecha_creacion: datetime
    ultimo_mensaje: Optional[MensajeChatResponse] = None

    model_config = ConfigDict(from_attributes=True)


class CerrarTicketRequest(BaseModel):
    """Cierre de un ticket con constancia de qué se hizo."""
    resolucion: str = Field(..., min_length=5, max_length=2000)


class EscalarTicketRequest(BaseModel):
    """Sube el ticket de nivel y lo reasigna a alguien que pueda con él."""
    nivel: int = Field(..., ge=1, le=3)
    motivo: Optional[str] = Field(None, max_length=500)


class CalificarSoporteRequest(BaseModel):
    """Puntuación del servicio recibido, de 1 a 5."""
    calificacion: int = Field(..., ge=1, le=5)
    comentario: Optional[str] = Field(None, max_length=1000)


class AbrirSoporteRequest(BaseModel):
    """Petición de ayuda al equipo de la plataforma."""
    asunto: str = Field(..., min_length=5, max_length=160)
    urgencia: Literal["critica", "alta", "media", "baja"] = "media"
    mensaje: Optional[str] = Field(None, max_length=2000)


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


# ==================== Calculadora de precios (chat de negociación) ====================

class EstimacionPrecioRequest(BaseModel):
    """Datos que la empresa mete en la calculadora. Importes en `moneda`."""
    moneda: Literal["USD", "COP", "EUR", "CNY"] = "USD"
    cantidad: int = Field(..., ge=1, le=10_000_000)
    precio_unitario: float = Field(..., ge=0, le=1_000_000_000)
    flete_internacional: float = Field(0, ge=0, le=1_000_000_000)
    seguro_pct: float = Field(0, ge=0, le=100, description="Sobre mercancía + flete")
    arancel_pct: float = Field(0, ge=0, le=100, description="Sobre el valor CIF")
    iva_pct: float = Field(19, ge=0, le=100, description="Sobre CIF + arancel")
    gastos_destino: float = Field(0, ge=0, le=1_000_000_000, description="Agenciamiento, bodegaje, transporte local")
    margen_pct: float = Field(0, ge=0, le=100, description="Sobre CIF + arancel + gastos en destino")
    rango_pct: float = Field(0, ge=0, le=50, description="± % para dar un rango de precios posibles")
    tasa_cambio_cop: Optional[float] = Field(None, gt=0, le=100_000, description="Para mostrar el total en COP")
    incoterm: Optional[Literal["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]] = None
    tiempo_entrega: Optional[str] = Field(None, max_length=100)
    validez_dias: Optional[int] = Field(None, ge=1, le=90)
    notas: Optional[str] = Field(None, max_length=1000)


class DesgloseEstimacion(BaseModel):
    valor_mercancia: float
    flete_internacional: float
    seguro: float
    valor_cif: float
    arancel: float
    iva: float
    gastos_destino: float
    margen: float
    total: float
    costo_unitario: float
    total_minimo: float
    total_maximo: float
    total_cop: Optional[float] = None


class EstimacionPrecioResponse(BaseModel):
    """Vista previa: lo mismo que llevará el mensaje si la empresa lo envía."""
    entrada: EstimacionPrecioRequest
    desglose: DesgloseEstimacion
    resumen: str
