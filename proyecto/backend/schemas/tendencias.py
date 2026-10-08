from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from services.tendencias import MAX_ANGULOS, MAX_FOTOS_POR_PRODUCTO, MAX_PRODUCTOS_POR_EDICION

Preset = Literal["lavanda", "violeta", "amarillo", "noche"]
Transporte = Literal["mar", "aereo"]

# Eventos que registra el navegador. Los demás (guardado, aviso suscrito,
# solicitud creada) los registra el servidor cuando ocurren.
EventoCliente = Literal[
    "edicion_vista", "producto_visto", "modo_cambiado", "pedir_propuestas_clic",
    "calendario_visto", "aviso_abierto", "video_reproducido",
]


def _limpiar(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    return v or None


class EdicionCrear(BaseModel):
    semana_inicio: date
    titulo_linea1: str = Field(..., min_length=1, max_length=40)
    titulo_linea2: str = Field(..., min_length=1, max_length=40)
    subtitulo: str = Field(..., min_length=1, max_length=140)
    preset_estilo: Preset = "lavanda"


class EdicionActualizar(BaseModel):
    semana_inicio: Optional[date] = None
    titulo_linea1: Optional[str] = Field(None, min_length=1, max_length=40)
    titulo_linea2: Optional[str] = Field(None, min_length=1, max_length=40)
    subtitulo: Optional[str] = Field(None, min_length=1, max_length=140)
    preset_estilo: Optional[Preset] = None


class ProductoEnEdicion(BaseModel):
    producto_id: str
    destacado: bool = False


class EdicionProductos(BaseModel):
    """Lista completa y ordenada de productos de la edición. Reemplaza la anterior."""
    productos: List[ProductoEnEdicion] = Field(..., max_length=MAX_PRODUCTOS_POR_EDICION)

    @model_validator(mode="after")
    def sin_repetidos(self):
        ids = [p.producto_id for p in self.productos]
        if len(ids) != len(set(ids)):
            raise ValueError("Un producto no puede estar dos veces en la misma edición")
        if sum(1 for p in self.productos if p.destacado) > 1:
            raise ValueError("Solo puede haber un producto destacado")
        return self


class Programar(BaseModel):
    """Fecha y hora de publicación en hora de Bogotá. Sin valor: ahora mismo."""
    publicar_en: Optional[datetime] = None


class ProductoDatos(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    categoria_visible: str = Field(..., min_length=1, max_length=40)
    linea_producto: Optional[str] = Field(None, max_length=100)
    pais_origen: str = Field("China", min_length=1, max_length=100)
    fotos: List[str] = Field(default_factory=list, max_length=MAX_FOTOS_POR_PRODUCTO)
    # Rutas de gestión documental (`/documentos/archivos/{id}/descargar`).
    video_horizontal: Optional[str] = Field(None, max_length=500)
    video_vertical: Optional[str] = Field(None, max_length=500)
    por_que_ahora: str = Field(..., min_length=1, max_length=220)
    temporada_id: Optional[str] = None
    fecha_en_bodega: Optional[date] = None
    transporte_sugerido: Transporte = "mar"
    dias_mar: Optional[int] = Field(None, ge=1, le=365)
    dias_aereo: Optional[int] = Field(None, ge=1, le=365)
    revisar_requisitos: bool = False
    para_negocio: bool = False
    guia_para_quien: Optional[str] = None
    guia_angulos: List[str] = Field(default_factory=list, max_length=MAX_ANGULOS)
    guia_donde: Optional[str] = None
    guia_contenido: Optional[str] = None
    que_pedir_en_cotizacion: Optional[str] = None

    @field_validator(
        "video_horizontal", "video_vertical", "linea_producto", "temporada_id", "guia_para_quien", "guia_donde", "guia_contenido",
        "que_pedir_en_cotizacion",
    )
    @classmethod
    def textos_limpios(cls, v: Optional[str]) -> Optional[str]:
        return _limpiar(v)

    @field_validator("fotos")
    @classmethod
    def fotos_limpias(cls, v: List[str]) -> List[str]:
        fotos: List[str] = []
        for url in v:
            url = (url or "").strip()
            if url and url not in fotos:
                fotos.append(url)
        return fotos

    @field_validator("guia_angulos")
    @classmethod
    def angulos_cortos(cls, v: List[str]) -> List[str]:
        angulos = [a.strip() for a in v if a and a.strip()]
        if any(len(a) > 80 for a in angulos):
            raise ValueError("Cada ángulo de venta tiene máximo 80 caracteres")
        return angulos


class CalcularFechas(BaseModel):
    """Cálculo en vivo para el editor del curador."""
    temporada_id: Optional[str] = None
    fecha_en_bodega: Optional[date] = None
    dias_mar: Optional[int] = Field(None, ge=1, le=365)
    dias_aereo: Optional[int] = Field(None, ge=1, le=365)
    # Fecha contra la que se evalúa el estado: la de publicación de la edición.
    fecha_referencia: Optional[date] = None


class TemporadaDatos(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    fecha: date
    ejemplos: Optional[str] = Field(None, max_length=200)


class CierreDatos(BaseModel):
    inicio: date
    fin: date
    fin_produccion_previa: date

    @model_validator(mode="after")
    def orden_logico(self):
        if self.fin < self.inicio:
            raise ValueError("El fin del cierre no puede ser anterior a su inicio")
        if self.fin_produccion_previa > self.inicio:
            raise ValueError("La producción previa debe terminar antes de que empiece el cierre")
        return self


class Parametros(BaseModel):
    dias_mar: int = Field(..., ge=1, le=365)
    dias_aereo: int = Field(..., ge=1, le=365)
    dias_produccion: int = Field(..., ge=0, le=180)
    # Sin precio (o 0) la suscripción no se vende; solo se regala.
    precio_cop: Optional[int] = Field(None, ge=0, le=100_000_000)
    dias_suscripcion: int = Field(..., ge=1, le=3650)


class OtorgarAcceso(BaseModel):
    email: EmailStr
    dias: int = Field(..., ge=1, le=3650)
    nota: Optional[str] = Field(None, max_length=255)


class AccesoLibre(BaseModel):
    """Periodo de acceso libre. Uno de los dos, o ninguno para cerrarlo."""
    dias: Optional[int] = Field(None, ge=1, le=365)
    # Fecha y hora de fin, en hora de Bogotá.
    hasta: Optional[datetime] = None

    @model_validator(mode="after")
    def uno_solo(self):
        if self.dias is not None and self.hasta is not None:
            raise ValueError("Indica los días o la fecha de fin, no ambos")
        return self


class Curador(BaseModel):
    es_curador: bool


class EventoTendencias(BaseModel):
    tipo: EventoCliente
    edicion_id: Optional[str] = None
    producto_id: Optional[str] = None
    modo: Optional[Transporte] = None
    # Para `video_reproducido`: qué versión se vio.
    encuadre: Optional[Literal["horizontal", "vertical"]] = None


class Guardar(BaseModel):
    edicion_id: Optional[str] = None
