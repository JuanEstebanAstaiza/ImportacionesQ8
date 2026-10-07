from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

from utils.shipping_mark import LONGITUD_MAX_SUFIJO, normalizar_segmento

MAX_FOTOS_PRODUCTO = 10

class ContactoAsignadoResponse(BaseModel):
    """Contacto de la empresa importadora a cargo de negociar una cotización
    (Semana 4 - Fase 7: navegación cruzada / contacto del asesor asignado)."""
    usuario_id: str
    nombre: Optional[str] = None
    foto_url: Optional[str] = None
    whatsapp: Optional[str] = None

    model_config = {"from_attributes": True}

class CotizacionCreate(BaseModel):
    modalidad: str = Field(..., description="Modalidad de cotización: 'dirigida' o 'abierta'")
    # Se ignora: el servidor toma el tier de la empresa destino. Se conserva
    # para no romper a los clientes que todavía lo envían.
    tier_minimo_requerido: Optional[str] = Field(
        default=None,
        json_schema_extra={"deprecated": True},
        description="Ignorado. El tier exigido lo define la empresa (Importador.tier_minimo_requerido)",
    )

    @field_validator("incoterm")
    @classmethod
    def validar_incoterm(cls, v: str) -> str:
        valor = (v or "DDP").strip().upper()
        return valor or "DDP"
    
    @field_validator("modalidad")
    @classmethod
    def validar_modalidad(cls, v):
        """Validar que la modalidad sea 'dirigida' o 'abierta'"""
        if v not in ("dirigida", "abierta"):
            raise ValueError(f"Modalidad inválida: '{v}'. Debe ser 'dirigida' o 'abierta'")
        return v
    
    @field_validator("tipo_calidad")
    @classmethod
    def validar_tipo_calidad(cls, v):
        """Validar que el tipo de calidad sea válido"""
        if v not in ("economica", "estandar", "premium"):
            raise ValueError(f"Tipo de calidad inválido: '{v}'. Debe ser 'economica', 'estandar' o 'premium'")
        return v
    
    importador_id: Optional[str] = None  # Solo para modalidad dirigida
    # Obsoleto: una sola foto. Se acepta para no romper clientes anteriores y
    # se trata como una galería de un elemento.
    foto_producto: Optional[str] = None
    fotos_producto: Optional[List[str]] = Field(
        default=None,
        description=f"URLs de las fotos del producto, en orden. Máximo {MAX_FOTOS_PRODUCTO}.",
    )
    pais_importacion: str = Field(..., min_length=1, description="País desde donde se importa")
    nivel_personalizacion: Optional[str] = None
    nombre_producto: str = Field(..., min_length=1, max_length=255, description="Nombre del producto a importar")
    descripcion_cliente: str = Field(..., min_length=10, description="Descripción detallada del producto")
    link_referencia: Optional[str] = None
    linea_producto: str = Field(..., min_length=1, max_length=100, description="Categoría/línea del producto")
    tipo_calidad: str = Field(..., description="Tipo de calidad: 'economica', 'estandar' o 'premium'")
    modalidad_importacion: Optional[str] = None
    cantidad_minima: float = Field(..., gt=0, description="Cantidad mínima a importar, en `unidad_cantidad`")
    unidad_cantidad: Literal["unidades", "m3"] = Field(
        default="unidades", description="Unidad de la cantidad: 'unidades' o 'm3' (metros cúbicos)"
    )
    precio_objetivo_usd: Optional[float] = Field(default=None, ge=0, description="Precio objetivo en USD, mayor o igual a cero")
    precio_objetivo_moneda: str = Field(
        default="USD",
        min_length=3,
        max_length=10,
        validation_alias=AliasChoices("precio_objetivo_moneda", "moneda_precio_objetivo"),
        description="Moneda del precio objetivo (USD, EUR, COP, etc.)",
    )
    incoterm: str = Field(default="DDP", min_length=1, max_length=50, description="Incoterm acordado (FOB, CIF, etc.)")
    notas_adicionales: Optional[str] = None
    shipping_mark_sufijo: Optional[str] = Field(
        None,
        max_length=LONGITUD_MAX_SUFIJO,
        description=(
            "Tu parte de la marca de embarque (ej. 'prendas control'). Se une al prefijo "
            "de la empresa importadora para rotular tus cajas: 'ctl-prendascontrol'."
        ),
    )
    campos_personalizados_valores: Optional[Dict[str, Any]] = Field(
        None, description="Valores de los campos personalizados del importador dirigido, si aplica: {campo_id: valor}"
    )
    origen: Literal["directa", "tendencias", "catalogo"] = Field(
        default="directa", description="De dónde sale la solicitud: formulario, Tendencias o catálogo de una empresa"
    )
    tendencia_edicion_id: Optional[str] = None
    tendencia_producto_id: Optional[str] = None
    catalogo_producto_id: Optional[str] = None

    @field_validator("fotos_producto")
    @classmethod
    def validar_fotos_producto(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        fotos = []
        for url in v:
            url = (url or "").strip()
            if not url:
                continue
            if len(url) > 500:
                raise ValueError("La dirección de una foto supera los 500 caracteres")
            if url not in fotos:
                fotos.append(url)
        if len(fotos) > MAX_FOTOS_PRODUCTO:
            raise ValueError(f"Puedes adjuntar como máximo {MAX_FOTOS_PRODUCTO} fotos del producto")
        return fotos

    @model_validator(mode="after")
    def unificar_fotos(self):
        # Quien envía solo `foto_producto` (clientes anteriores) obtiene una
        # galería de una foto; quien envía la galería, su primera foto de portada.
        if self.fotos_producto is None and self.foto_producto:
            self.fotos_producto = [self.foto_producto.strip()]
        if self.fotos_producto:
            self.foto_producto = self.fotos_producto[0]
        elif self.fotos_producto is not None:
            self.foto_producto = None
        return self

    @model_validator(mode="after")
    def cantidad_entera_en_unidades(self):
        # Fracciones solo en m³: "2,5 unidades" no se puede despachar.
        if self.unidad_cantidad == "unidades" and float(self.cantidad_minima) != int(self.cantidad_minima):
            raise ValueError("La cantidad en unidades debe ser un número entero")
        return self

    @field_validator("precio_objetivo_moneda")
    @classmethod
    def validar_moneda_precio_objetivo(cls, v: str) -> str:
        moneda = (v or "USD").strip().upper()
        if not moneda:
            return "USD"
        if len(moneda) < 3 or len(moneda) > 10:
            raise ValueError("La moneda del precio objetivo debe tener entre 3 y 10 caracteres")
        return moneda

    @field_validator("shipping_mark_sufijo")
    @classmethod
    def sufijo_utilizable(cls, v: Optional[str]) -> Optional[str]:
        """Se guarda tal cual lo escribe el cliente, pero tiene que dejar algo
        rotulable: un sufijo de solo signos ("///") produciría un shipping mark
        vacío y es mejor rechazarlo aquí que descubrirlo en el puerto."""
        if v is None:
            return None
        if not v.strip():
            return None
        if not normalizar_segmento(v):
            raise ValueError(
                "El sufijo del shipping mark debe contener al menos una letra o un número"
            )
        return v.strip()

class CotizacionResponse(BaseModel):
    id: str
    solicitante_id: str
    importador_id: Optional[str]
    modalidad: str
    tier_minimo_requerido: str = "Bronze"
    desbloqueada_por_puntos: bool = False
    solicitante_tier: str = "Bronze"
    solicitante_puntos_cotizacion: int = 0
    bloqueada: bool = False
    foto_producto: Optional[str]
    fotos_producto: List[str] = Field(default_factory=list, validate_default=True)
    origen: str = "directa"
    tendencia_edicion_id: Optional[str] = None
    tendencia_producto_id: Optional[str] = None
    catalogo_producto_id: Optional[str] = None

    @field_validator("fotos_producto", mode="before")
    @classmethod
    def galeria_o_portada(cls, v, info):
        # Las cotizaciones anteriores a la galería solo tienen `foto_producto`.
        if v:
            return v
        portada = info.data.get("foto_producto")
        return [portada] if portada else []
    pais_importacion: str
    nivel_personalizacion: Optional[str]
    nombre_producto: str
    descripcion_cliente: str
    link_referencia: Optional[str]
    linea_producto: str
    tipo_calidad: str
    modalidad_importacion: Optional[str]
    cantidad_minima: float
    unidad_cantidad: str = "unidades"
    precio_objetivo_usd: Optional[float] = Field(default=None, ge=0)
    precio_objetivo_moneda: str = "USD"
    moneda_precio_objetivo: Optional[str] = None
    incoterm: str = "DDP"
    notas_adicionales: Optional[str]

    model_config = {"from_attributes": True}
    shipping_mark_sufijo: Optional[str] = None
    # Marca de embarque ya compuesta ("ctl-prendascontrol"). Es None mientras no
    # se sepa qué empresa importará: en modalidad abierta, hasta que una gane.
    shipping_mark: Optional[str] = None
    campos_personalizados_valores: Optional[Dict[str, Any]] = None
    asesor_asignado_id: Optional[str] = None
    estado: str  # "creada", "dirigida", "abierta", etc.
    costo_creditos: Optional[float] = None
    cotizacion_origen_id: Optional[str] = None
    cancelada_por_error: Optional[str] = None
    motivo_cancelacion: Optional[str] = None
    motivo_eleccion: Optional[str] = None
    motivo_eleccion_detalle: Optional[str] = None
    # --- Navegación cruzada (Fase 7): saltar de la cotización al chat/contacto ---
    conversacion_id: Optional[str] = None
    contacto_asignado: Optional[ContactoAsignadoResponse] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    model_config = {"from_attributes": True}

# ==================== Propuesta Schemas ====================

class PropuestaCreate(BaseModel):
    cotizacion_id: str  # ID de la cotización a la que responde
    precio_ofrecido_usd: float = Field(..., gt=0, description="Precio ofrecido por el importador")
    tiempo_estimado_entrega: str = Field(..., min_length=1, max_length=100, description="Tiempo estimado (ej: '45 días')")
    incoterm: str = Field(..., min_length=1, max_length=50, description="Incoterm propuesto (FOB, CIF, EXW, DDP, etc.)")
    condiciones_adicionales: Optional[str] = None  # Condiciones adicionales
    cantidad: Optional[float] = Field(
        None, gt=0, description="Cantidad que cubre el precio, en la unidad de la cotización (por defecto, la pedida)"
    )

class EmpresaPropuestaResumen(BaseModel):
    """Lo que el comprador necesita para comparar a quién le compra: no solo
    precio y plazo, también cómo cumple esa empresa."""
    importador_id: str
    nombre_empresa: str
    logo_url: Optional[str] = None
    verificado: bool = False
    calificacion_promedio: float = 0
    total_resenas: int = 0
    pedidos_entregados: int = 0
    pedidos_en_curso: int = 0


class PropuestaResponse(BaseModel):
    id: str
    cotizacion_id: str
    importador_id: str
    precio_ofrecido_usd: float
    tiempo_estimado_entrega: str
    incoterm: str
    condiciones_adicionales: Optional[str]
    estado: str  # "borrador", "pendiente", "aceptada", "rechazada"
    creado_por_usuario_id: Optional[str] = None
    preaceptada_por_solicitante: bool = False
    preaceptada_por_empresa: bool = False
    cantidad: Optional[float] = None
    fecha_envio: Optional[datetime] = None
    # Veces que la empresa la reescribió tras enviarla, y cuándo fue la última.
    # El comprador necesita verlo: una propuesta ajustada después de llegar ya
    # no es la que comparó al principio.
    revisiones: int = 0
    fecha_modificacion: Optional[datetime] = None
    motivo_descarte: Optional[str] = None
    motivo_descarte_detalle: Optional[str] = None
    # Solo para el comprador: la empresa que la envió y su cumplimiento.
    empresa: Optional[EmpresaPropuestaResumen] = None
    # --- Navegación cruzada (Fase 7): contacto de quien redactó/envió la propuesta ---
    contacto_asesor: Optional[ContactoAsignadoResponse] = None

    model_config = {"from_attributes": True}

class PropuestaAceptadaRequest(BaseModel):
    importador_id: str  # ID del importador cuya propuesta se acepta

class PreaceptarPropuestaRequest(BaseModel):
    """Marca (o revierte) la pre-aceptación de tu lado sobre una propuesta.

    Cuando ambos lados (solicitante y empresa) quedan en `aceptar=True`, la
    propuesta se finaliza automáticamente: se crea la Orden y el chat se
    traspasa al dueño de la empresa (ver `pre_aceptar_propuesta`).
    """
    aceptar: bool = True
    # Solo el solicitante, al aceptar habiendo otras propuestas: qué lo decidió.
    # Al cerrarse la orden queda como motivo de descarte de las demás.
    motivo_eleccion: Optional[Literal["precio", "tiempo", "condiciones", "otro"]] = None
    motivo_detalle: Optional[str] = Field(None, max_length=500)

# ==================== Estado de matching de cotizaciones abiertas ====================

class ImportadorPendienteResponse(BaseModel):
    """Datos mínimos de un importador que aún no respondió a una cotización abierta,
    usados en el panel de "Propuestas Recibidas" (wireframe Pantalla 6)."""
    importador_id: str
    nombre_empresa: str
    logo_url: Optional[str] = None

class MatchingStatusResponse(BaseModel):
    """Estado de difusión de una cotización abierta a la red de importadores."""
    total_matching: int
    respondidos: int
    pendientes: int
    importadores_pendientes: List[ImportadorPendienteResponse]

# ==================== Actualizar schemas/__init__.py exports ====================
