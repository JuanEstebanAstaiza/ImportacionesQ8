"""Propuesta rápida: dos precios, entrega, tiempo y permisos.

Reemplaza la calculadora del chat y el formulario de tres pasos. La empresa
escribe el precio por unidad en China (USD) y el total de logística y
nacionalización (USD o COP); el resto sale de sus «Condiciones de tus
propuestas», que se llenan una vez. El cliente recibe un **precio cerrado en
pesos, IVA incluido**, con la entrega, el tiempo, los permisos y las
condiciones a la vista.

Se guarda **sin migración**:

- La propuesta: el formulario y sus totales van como JSON en
  `propuestas.condiciones_adicionales` (`schema: "propuesta-v2"`), que al
  crearse la orden se copia tal cual a `ordenes.condiciones_adicionales`.
  `precio_ofrecido_usd` guarda el total convertido a USD con la TRM de la
  propuesta, para que lo que ya suma en USD (métricas, tier, panel) siga igual.
- Las condiciones de cada empresa: en `configuracion_plataforma`, con la clave
  `empresa.<id>.condiciones_propuesta`. Cada propuesta lleva una copia de las
  condiciones con que se envió: cambiarlas después no altera lo ya enviado.
- La ciudad de entrega del comprador: en `cotizaciones.campos_personalizados_valores`
  bajo la clave reservada `_ciudad_entrega` (ver `models/cotizacion.py`).

El cálculo es el mismo del frontend (`features/propuestas/calculo.ts`): aquí se
rehace para no confiar en los totales que manda el navegador.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from typing import List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session

ESQUEMA = "propuesta-v2"
CLAVE_CONDICIONES = "empresa.{importador_id}.condiciones_propuesta"
# Lo que el diseño fija para todas las importadoras: no se configura.
VARIACION_MAXIMA_PCT = 10

FORMAS_PAGO = {
    "50-50": "50 % de anticipo y 50 % al llegar a bodega",
    "30-70": "30 % de anticipo y 70 % antes del despacho",
    "100": "100 % anticipado",
}
VIAS = {"maritimo": "marítimo", "aereo": "aéreo"}


def _texto(v: Optional[str], largo: int) -> Optional[str]:
    v = (v or "").strip()
    return v[:largo] or None


# ── Condiciones de la empresa (pantalla 3) ───────────────────────────────────

class RangoDias(BaseModel):
    minimo: int = Field(..., ge=1, le=730)
    maximo: int = Field(..., ge=1, le=730)

    @model_validator(mode="after")
    def maximo_no_menor(self):
        if self.maximo < self.minimo:
            raise ValueError("El máximo tiene que ser igual o mayor que el mínimo")
        return self


class CancelacionPropuesta(BaseModel):
    antes_orden: str = Field("Reintegro total.", max_length=300)
    en_fabricacion: str = Field("Se retienen los costos no recuperables acreditados.", max_length=300)
    despachada: str = Field("No se cancela.", max_length=300)


class CondicionesPropuesta(BaseModel):
    """«Mi empresa › Condiciones de tus propuestas»."""
    bodega_ciudad: str = Field("", max_length=100)
    bodega_direccion: str = Field("", max_length=200)
    # Ciudades donde la entrega va incluida (la de la bodega y sus vecinas).
    ciudades_entrega_incluida: List[str] = Field(default_factory=list, max_length=30)
    # Para el resto de ciudades, lo que se propone por defecto.
    entrega_otras_ciudades: Literal["cliente", "fijo", "incluida"] = "cliente"
    tiempo_maritimo: RangoDias = Field(default_factory=lambda: RangoDias(minimo=40, maximo=50))
    tiempo_aereo: RangoDias = Field(default_factory=lambda: RangoDias(minimo=15, maximo=20))
    vigencia_dias: int = Field(15, ge=1, le=90)
    iva_pct: Literal[0, 5, 19] = 19
    forma_pago: Literal["50-50", "30-70", "100"] = "50-50"
    seguro_incluido: bool = True
    tolerancia_pct: float = Field(3, ge=0, le=20)
    dias_reclamo: int = Field(3, ge=3, le=60)
    cancelacion: CancelacionPropuesta = Field(default_factory=CancelacionPropuesta)
    supuestos: str = Field(
        "Cambio de peso o volumen frente a lo informado por el proveedor.", max_length=500,
    )

    @field_validator("ciudades_entrega_incluida")
    @classmethod
    def limpiar_ciudades(cls, v: List[str]) -> List[str]:
        vistas, limpias = set(), []
        for ciudad in v:
            c = (ciudad or "").strip()[:100]
            if c and c.lower() not in vistas:
                vistas.add(c.lower())
                limpias.append(c)
        return limpias


def condiciones_de(db: Session, importador_id: str) -> CondicionesPropuesta:
    """Las guardadas, o las de por defecto si la empresa todavía no las llenó."""
    from services.configuracion import obtener

    crudo = obtener(db, CLAVE_CONDICIONES.format(importador_id=importador_id))
    if crudo:
        try:
            return CondicionesPropuesta.model_validate_json(crudo)
        except ValueError:
            pass
    return CondicionesPropuesta()


def tiene_condiciones(db: Session, importador_id: str) -> bool:
    from services.configuracion import obtener

    return bool(obtener(db, CLAVE_CONDICIONES.format(importador_id=importador_id)))


def guardar_condiciones(db: Session, importador_id: str, condiciones: CondicionesPropuesta,
                        usuario_id: Optional[str] = None) -> None:
    from services.configuracion import guardar

    guardar(db, CLAVE_CONDICIONES.format(importador_id=importador_id),
            condiciones.model_dump_json(), usuario_id)


# ── Formulario de la propuesta (pantalla 1) ──────────────────────────────────

class FormularioPropuesta(BaseModel):
    # 1 · Precio
    precio_unitario_usd: float = Field(..., gt=0, le=1_000_000, description="Precio por unidad en China (USD)")
    cantidad: float = Field(..., gt=0, le=100_000_000)
    logistica_valor: float = Field(..., ge=0, le=100_000_000_000,
                                   description="Logística y nacionalización, total del envío")
    logistica_moneda: Literal["USD", "COP"] = "USD"
    trm: float = Field(..., gt=0, le=100_000)
    iva_pct: Literal[0, 5, 19] = 19
    # 2 · Entrega
    bodega_ciudad: str = Field(..., min_length=2, max_length=100)
    bodega_direccion: Optional[str] = Field(None, max_length=200)
    ciudad_destino: str = Field(..., min_length=2, max_length=100)
    entrega_modo: Literal["incluida", "fijo", "cliente"]
    entrega_valor_cop: Optional[float] = Field(None, ge=0, le=10_000_000_000)
    flete_aprox_cop: Optional[float] = Field(None, ge=0, le=10_000_000_000)
    # 3 · Tiempo
    via: Literal["maritimo", "aereo"]
    dias_min: int = Field(..., ge=1, le=730)
    dias_max: int = Field(..., ge=1, le=730)
    # 4 · Permisos
    requiere_permisos: bool
    permiso_cual: Optional[str] = Field(None, max_length=200)
    permiso_gestiona: Literal["importadora", "cliente"] = "importadora"
    # Nota y desglose
    nota: Optional[str] = Field(None, max_length=1000)
    mostrar_desglose: bool = False

    @model_validator(mode="after")
    def coherente(self):
        if self.dias_max < self.dias_min:
            raise ValueError("El máximo tiene que ser igual o mayor que el mínimo")
        if self.entrega_modo == "fijo" and not (self.entrega_valor_cop or 0) > 0:
            raise ValueError("Falta el valor de la entrega")
        if self.requiere_permisos and len((self.permiso_cual or "").strip()) < 2:
            raise ValueError("Falta cuál permiso o registro necesita el producto")
        self.bodega_ciudad = self.bodega_ciudad.strip()
        self.ciudad_destino = self.ciudad_destino.strip()
        self.bodega_direccion = _texto(self.bodega_direccion, 200)
        self.permiso_cual = _texto(self.permiso_cual, 200) if self.requiere_permisos else None
        self.nota = _texto(self.nota, 1000)
        if self.entrega_modo != "fijo":
            self.entrega_valor_cop = None
        if self.entrega_modo != "cliente":
            self.flete_aprox_cop = None
        return self


def calcular(f: FormularioPropuesta) -> dict:
    """Totales en pesos. Mismo cálculo que `features/propuestas/calculo.ts`."""
    producto_usd = f.precio_unitario_usd * f.cantidad
    producto_cop = producto_usd * f.trm
    logistica_cop = f.logistica_valor * f.trm if f.logistica_moneda == "USD" else f.logistica_valor
    entrega_cop = (f.entrega_valor_cop or 0) if f.entrega_modo == "fijo" else 0
    subtotal = producto_cop + logistica_cop + entrega_cop
    iva = subtotal * f.iva_pct / 100
    total = subtotal + iva
    return {
        "producto_usd": round(producto_usd, 2),
        "producto_cop": round(producto_cop),
        "logistica_cop": round(logistica_cop),
        "entrega_cop": round(entrega_cop),
        "subtotal_cop": round(subtotal),
        "iva_cop": round(iva),
        "total_cop": round(total),
        "unitario_cop": round(total / f.cantidad),
        "unitario_usd": round(total / f.cantidad / f.trm, 2),
        "total_usd": round(total / f.trm, 2),
    }


def _pesos(n: float) -> str:
    return "$" + f"{round(n):,}".replace(",", ".")


def texto_tiempo(f: FormularioPropuesta | dict) -> str:
    d = f if isinstance(f, dict) else f.model_dump()
    return f"De {d['dias_min']} a {d['dias_max']} días desde el anticipo, {VIAS.get(d['via'], d['via'])}"


def armar(db: Session, f: FormularioPropuesta, importador_id: str) -> dict:
    """Lo que se guarda en `condiciones_adicionales` y los campos de la propuesta."""
    condiciones = condiciones_de(db, importador_id)
    totales = calcular(f)
    vigencia = date.today() + timedelta(days=condiciones.vigencia_dias)
    datos = {
        "schema": ESQUEMA,
        "formulario": f.model_dump(),
        "totales": totales,
        "condiciones": condiciones.model_dump(),
        "vigencia_hasta": vigencia.isoformat(),
        "variacion_maxima_pct": VARIACION_MAXIMA_PCT,
    }
    return {
        "precio_ofrecido_usd": totales["total_usd"],
        "tiempo_estimado_entrega": texto_tiempo(f)[:100],
        # Precio puesto en Colombia, con aranceles y nacionalización.
        "incoterm": "DDP",
        "condiciones_adicionales": json.dumps(datos, ensure_ascii=False),
        "cantidad": f.cantidad,
        "moq_unit": "unidades",
    }


def leer(texto: Optional[str]) -> Optional[dict]:
    """Los datos de una propuesta del formato nuevo, o None si es de las anteriores."""
    if not texto:
        return None
    try:
        datos = json.loads(texto)
    except (TypeError, ValueError):
        return None
    if isinstance(datos, dict) and datos.get("schema") == ESQUEMA and isinstance(datos.get("totales"), dict):
        return datos
    return None


def monto_a_pagar(texto: Optional[str]) -> Optional[str]:
    """«$21.364.784 (COP, IVA incluido)» para la solicitud de pago, o None."""
    datos = leer(texto)
    if not datos:
        return None
    return f"{_pesos(datos['totales']['total_cop'])} (COP, IVA incluido)"


# ── Tarjeta en el chat (pantalla 2) ──────────────────────────────────────────

def resumen(datos: dict, empresa: str) -> str:
    """Texto plano de la tarjeta: vista previa de la bandeja y notificaciones."""
    f, t = datos["formulario"], datos["totales"]
    return (
        f"Propuesta de {empresa}: {_pesos(t['total_cop'])} con IVA "
        f"({_pesos(t['unitario_cop'])} por unidad). {texto_tiempo(f)}."
    )


def _conversacion_de(db: Session, cotizacion, importador_id: str):
    """El chat de la negociación de esta empresa con el comprador (o uno nuevo)."""
    from models.chat import ConversacionChat, TipoConversacion
    from models.usuario import Usuario

    cuentas = [fila[0] for fila in db.query(Usuario.id).filter(Usuario.importador_id == importador_id).all()]
    conversacion = (
        db.query(ConversacionChat)
        .filter(
            ConversacionChat.cotizacion_id == cotizacion.id,
            ConversacionChat.tipo == TipoConversacion.negociacion.value,
            ConversacionChat.importador_usuario_id.in_(cuentas or [""]),
        )
        .first()
    )
    if conversacion:
        return conversacion
    dueño = db.query(Usuario).filter(Usuario.importador_id == importador_id, Usuario.rol == "importador").first()
    responsable = cotizacion.asesor_asignado_id if cotizacion.asesor_asignado_id in cuentas else None
    responsable = responsable or (str(dueño.id) if dueño else None)
    if not responsable:
        return None
    conversacion = ConversacionChat(
        id=str(uuid4()),
        cotizacion_id=cotizacion.id,
        solicitante_id=cotizacion.solicitante_id,
        importador_usuario_id=responsable,
    )
    db.add(conversacion)
    db.flush()
    return conversacion


def publicar_en_chat(db: Session, propuesta, cotizacion, remitente_id: str):
    """Deja la propuesta como tarjeta en el chat del comprador. Solo las del
    formato nuevo; cada versión (envío o edición) es una tarjeta. No hace commit."""
    from models.chat import MensajeChat, TipoMensajeChat
    from models.importador import Importador

    datos = leer(propuesta.condiciones_adicionales)
    if not datos:
        return None
    conversacion = _conversacion_de(db, cotizacion, propuesta.importador_id)
    if conversacion is None:
        return None
    empresa = db.query(Importador.nombre_empresa).filter(Importador.id == propuesta.importador_id).scalar() or "La empresa"
    mensaje = MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion.id,
        remitente_id=remitente_id,
        contenido=resumen(datos, empresa),
        tipo=TipoMensajeChat.propuesta.value,
        metadata_json={
            "tipo_evento": "propuesta_enviada",
            "propuesta_id": str(propuesta.id),
            "cotizacion_id": str(cotizacion.id),
            "version": (propuesta.revisiones or 0) + 1,
            "empresa": empresa,
            "producto": cotizacion.nombre_producto,
            "propuesta": datos,
            "enviada_en": datetime.utcnow().isoformat(),
        },
    )
    db.add(mensaje)
    return mensaje
