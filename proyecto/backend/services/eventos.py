"""Bitácora de eventos del negocio (tabla `eventos`).

Cada cambio de estado de una solicitud, una propuesta o un pedido deja aquí una
fila con su fecha y hora, quién lo hizo, el monto (en su moneda, en USD y en
pesos con la TRM del momento) y la cantidad con su unidad. Las métricas del
panel salen de esta tabla, así que una métrica nueva no exige rehacer nada:
basta con consultarla.

El evento se añade a la sesión de quien llama y se confirma en la misma
transacción que el cambio de estado: o quedan los dos, o ninguno.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models.evento import Evento


class TiposEvento:
    SOLICITUD_CREADA = "solicitud_creada"
    SOLICITUD_ASIGNADA = "solicitud_asignada"
    SOLICITUD_DESASIGNADA = "solicitud_desasignada"
    SOLICITUD_VISTA = "solicitud_vista"
    SOLICITUD_CANCELADA = "solicitud_cancelada"
    PROPUESTA_ENVIADA = "propuesta_enviada"
    PROPUESTA_EDITADA = "propuesta_editada"
    PROPUESTA_EN_NEGOCIACION = "propuesta_en_negociacion"
    PROPUESTA_PREACEPTADA = "propuesta_preaceptada"
    PROPUESTA_ACEPTADA = "propuesta_aceptada"
    PROPUESTA_DESCARTADA = "propuesta_descartada"
    PEDIDO_HITO = "pedido_hito"


MOTIVOS_DESCARTE = ("precio", "tiempo", "condiciones", "otro")
ETIQUETAS_MOTIVO = {
    "precio": "Precio",
    "tiempo": "Tiempo de entrega",
    "condiciones": "Condiciones",
    "otro": "Otro motivo",
    "sin_motivo": "Sin motivo registrado",
}

UNIDADES_CANTIDAD = ("unidades", "m3")

# Etapas del pedido tal como las nombra el negocio. Cada estado de la orden cae
# en una; "entregado" ya no está en proceso.
ETAPAS_PEDIDO = ("compra", "embarque", "transito", "nacionalizacion", "entrega")
ETAPA_POR_ESTADO_ORDEN = {
    "cotizacion_aceptada": "compra",
    "en_produccion": "embarque",
    "transito_internacional": "transito",
    "aduana_nacionalizacion": "nacionalizacion",
    "bodega_local": "entrega",
    "entregado": "entregado",
}


def convertir_montos(monto: Optional[float], moneda: Optional[str], trm: Optional[float]) -> Dict[str, Optional[float]]:
    """Monto en USD y en COP a partir de su moneda de origen.

    Solo se convierten USD y COP: con otra moneda (EUR, CNY...) se guarda el
    monto original y los convertidos quedan vacíos, en vez de inventar una tasa.
    """
    if monto is None:
        return {"monto_usd": None, "monto_cop": None}
    moneda = (moneda or "USD").upper()
    if moneda == "USD":
        return {"monto_usd": float(monto), "monto_cop": round(float(monto) * trm, 2) if trm else None}
    if moneda == "COP":
        return {"monto_usd": round(float(monto) / trm, 2) if trm else None, "monto_cop": float(monto)}
    return {"monto_usd": None, "monto_cop": None}


def _actor(usuario: Optional[dict]) -> Dict[str, Optional[str]]:
    if not usuario:
        return {"usuario_id": None, "rol_usuario": None}
    return {"usuario_id": str(usuario.get("user_id")) if usuario.get("user_id") else None, "rol_usuario": usuario.get("rol")}


def registrar_evento(
    db: Session,
    tipo: str,
    *,
    cotizacion_id: Optional[str] = None,
    propuesta_id: Optional[str] = None,
    orden_id: Optional[str] = None,
    importador_id: Optional[str] = None,
    usuario: Optional[dict] = None,
    estado_anterior: Optional[str] = None,
    estado_nuevo: Optional[str] = None,
    motivo: Optional[str] = None,
    motivo_detalle: Optional[str] = None,
    monto: Optional[float] = None,
    moneda: Optional[str] = None,
    cantidad: Optional[float] = None,
    unidad: Optional[str] = None,
    datos: Optional[Dict[str, Any]] = None,
    fecha: Optional[datetime] = None,
) -> Evento:
    trm_info = None
    trm = None
    if monto is not None:
        from services.trm import obtener_trm

        trm_info = obtener_trm(db)
        trm = trm_info["valor"]

    extra = dict(datos or {})
    if trm_info:
        extra.setdefault("trm_fuente", trm_info["fuente"])

    evento = Evento(
        tipo=tipo,
        fecha=fecha or datetime.utcnow(),
        cotizacion_id=str(cotizacion_id) if cotizacion_id else None,
        propuesta_id=str(propuesta_id) if propuesta_id else None,
        orden_id=str(orden_id) if orden_id else None,
        importador_id=str(importador_id) if importador_id else None,
        estado_anterior=_valor(estado_anterior),
        estado_nuevo=_valor(estado_nuevo),
        motivo=motivo,
        motivo_detalle=motivo_detalle,
        monto=float(monto) if monto is not None else None,
        moneda=(moneda or "USD").upper() if monto is not None else None,
        trm=trm,
        cantidad=float(cantidad) if cantidad is not None else None,
        unidad=unidad,
        datos=extra or None,
        **convertir_montos(monto, moneda, trm),
        **_actor(usuario),
    )
    db.add(evento)
    return evento


def _valor(estado) -> Optional[str]:
    if estado is None:
        return None
    return getattr(estado, "value", estado)


# ---------- Atajos por entidad ----------

def _cantidad_cotizacion(cotizacion) -> Dict[str, Any]:
    return {
        "cantidad": cotizacion.cantidad_minima,
        "unidad": getattr(cotizacion, "unidad_cantidad", None) or "unidades",
    }


def evento_solicitud(db: Session, tipo: str, cotizacion, *, usuario: Optional[dict] = None,
                     importador_id: Optional[str] = None, **extra) -> Evento:
    """Evento de la solicitud; el monto es el precio objetivo del cliente, si lo dio."""
    campos = dict(
        cotizacion_id=cotizacion.id,
        importador_id=importador_id,
        usuario=usuario,
        monto=cotizacion.precio_objetivo_usd,
        moneda=cotizacion.moneda_precio_objetivo or "USD",
        **_cantidad_cotizacion(cotizacion),
    )
    datos = {"modalidad": cotizacion.modalidad, "linea_producto": cotizacion.linea_producto}
    datos.update(extra.pop("datos", None) or {})
    campos.update(extra)
    return registrar_evento(db, tipo, datos=datos, **campos)


def evento_propuesta(db: Session, tipo: str, propuesta, cotizacion, *, usuario: Optional[dict] = None, **extra) -> Evento:
    """Evento de una propuesta: su precio total (USD) y la cantidad ofrecida."""
    cantidad = getattr(propuesta, "cantidad", None)
    campos = dict(
        cotizacion_id=cotizacion.id,
        propuesta_id=propuesta.id,
        importador_id=propuesta.importador_id,
        usuario=usuario,
        monto=propuesta.precio_ofrecido_usd,
        moneda="USD",
        cantidad=cantidad if cantidad is not None else cotizacion.cantidad_minima,
        unidad=getattr(cotizacion, "unidad_cantidad", None) or "unidades",
    )
    datos = {
        "modalidad": cotizacion.modalidad,
        "tiempo_estimado_entrega": propuesta.tiempo_estimado_entrega,
        "incoterm": propuesta.incoterm,
    }
    datos.update(extra.pop("datos", None) or {})
    campos.update(extra)
    return registrar_evento(db, tipo, datos=datos, **campos)


def evento_pedido(db: Session, orden, *, estado_anterior: Optional[str], estado_nuevo: str,
                  usuario: Optional[dict] = None, cotizacion=None) -> Evento:
    """Hito del pedido: cada cambio de estado de la orden, con su etapa."""
    estado_nuevo = _valor(estado_nuevo)
    cotizacion = cotizacion if cotizacion is not None else getattr(orden, "cotizacion", None)
    return registrar_evento(
        db,
        TiposEvento.PEDIDO_HITO,
        cotizacion_id=orden.cotizacion_id,
        orden_id=orden.id,
        importador_id=orden.importador_id,
        usuario=usuario,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        monto=orden.precio_acordado_usd,
        moneda="USD",
        cantidad=cotizacion.cantidad_minima if cotizacion is not None else None,
        unidad=(getattr(cotizacion, "unidad_cantidad", None) or "unidades") if cotizacion is not None else None,
        datos={"etapa": ETAPA_POR_ESTADO_ORDEN.get(estado_nuevo)},
    )


def registrar_vista(db: Session, cotizacion, *, importador_id: Optional[str], usuario: Optional[dict]) -> bool:
    """Primera vez que alguien de la empresa abre la solicitud. Devuelve si la registró."""
    if not importador_id:
        return False
    ya_vista = db.query(Evento.id).filter(
        Evento.tipo == TiposEvento.SOLICITUD_VISTA,
        Evento.cotizacion_id == str(cotizacion.id),
        Evento.importador_id == str(importador_id),
    ).first()
    if ya_vista:
        return False
    registrar_evento(
        db,
        TiposEvento.SOLICITUD_VISTA,
        cotizacion_id=cotizacion.id,
        importador_id=importador_id,
        usuario=usuario,
        datos={"modalidad": cotizacion.modalidad},
    )
    return True
