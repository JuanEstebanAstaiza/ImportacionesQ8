"""Panel comercial de la empresa importadora, calculado desde la bitácora.

Todo lo que es historia (recibidas, enviadas, cerradas, perdidas, valores) sale
de `eventos`; lo que es foto del momento (pedidos por etapa, pendientes de
responder, propuestas esperando al comprador) sale del estado actual.

Los montos se dan en pesos con la TRM guardada en cada evento. Los eventos
anteriores a la bitácora (rellenados por la migración 0025) no tienen TRM: se
convierten con la vigente.
"""
from collections import Counter
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models.cotizacion import Cotizacion, EstadoCotizacion
from models.evento import Evento
from models.orden import Orden
from models.propuesta import EstadoPropuesta, Propuesta
from models.recepcion_cotizacion import RecepcionCotizacion
from services.eventos import ETAPA_POR_ESTADO_ORDEN, ETAPAS_PEDIDO, MOTIVOS_DESCARTE, TiposEvento
from services.trm import obtener_trm

HORAS_ATENCION = 24
HORAS_URGENTE = 48
ESTADOS_SIN_CERRAR = (
    EstadoCotizacion.dirigida.value,
    EstadoCotizacion.abierta.value,
    EstadoCotizacion.propuestas_recibidas.value,
)


def nivel_espera(horas: float) -> str:
    if horas >= HORAS_URGENTE:
        return "urgente"
    if horas >= HORAS_ATENCION:
        return "atencion"
    return "a_tiempo"


def _en_pesos(evento: Evento, trm_actual: float) -> Optional[float]:
    if evento.monto_cop is not None:
        return float(evento.monto_cop)
    if evento.monto_usd is not None:
        return float(evento.monto_usd) * trm_actual
    return None


def _pct(parte: int, total: int) -> Optional[float]:
    return round(parte / total * 100, 1) if total else None


def _pendientes(db: Session, importador_id: str, ahora: datetime) -> List[dict]:
    """Solicitudes que la empresa tiene (dirigidas o asignadas) y aún no responde."""
    recibidas = {
        r.cotizacion_id: r.fecha_recepcion
        for r in db.query(RecepcionCotizacion).filter(
            RecepcionCotizacion.importador_id == importador_id,
            RecepcionCotizacion.entregada.is_(True),
        )
    }
    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.estado.in_(ESTADOS_SIN_CERRAR),
        (Cotizacion.id.in_(list(recibidas) or [""])) | (
            (Cotizacion.modalidad == "dirigida") & (Cotizacion.importador_id == importador_id)
        ),
    ).all()
    propuestas = {
        p.cotizacion_id: p.estado for p in db.query(Propuesta).filter(
            Propuesta.importador_id == importador_id,
            Propuesta.cotizacion_id.in_([c.id for c in cotizaciones] or [""]),
        )
    }
    pendientes = []
    for c in cotizaciones:
        estado = getattr(propuestas.get(c.id), "value", propuestas.get(c.id))
        if estado and estado != EstadoPropuesta.borrador.value:
            continue
        recibida = recibidas.get(c.id) or c.fecha_creacion or ahora
        horas = max((ahora - recibida).total_seconds() / 3600, 0)
        pendientes.append({
            "cotizacion_id": str(c.id),
            "nombre_producto": c.nombre_producto,
            "linea_producto": c.linea_producto,
            "modalidad": c.modalidad,
            "cantidad": c.cantidad_minima,
            "unidad": c.unidad_cantidad or "unidades",
            "recibida": recibida,
            "horas_esperando": round(horas, 1),
            "nivel": nivel_espera(horas),
            "con_borrador": estado == EstadoPropuesta.borrador.value,
        })
    pendientes.sort(key=lambda p: p["recibida"])
    return pendientes


def panel_empresa(db: Session, importador_id: str, dias: int = 90, ahora: Optional[datetime] = None) -> dict:
    ahora = ahora or datetime.utcnow()
    desde = ahora - timedelta(days=dias) if dias else None
    trm = obtener_trm(db)
    trm_actual = trm["valor"]

    consulta = db.query(Evento).filter(Evento.importador_id == importador_id)
    if desde is not None:
        consulta = consulta.filter(Evento.fecha >= desde)
    eventos = consulta.order_by(Evento.fecha).all()

    # Fuera del periodo también cuenta lo que pasó después con lo del periodo
    # (una propuesta enviada en el periodo y aceptada hoy).
    todos = db.query(Evento).filter(
        Evento.importador_id == importador_id,
        Evento.tipo.in_([
            TiposEvento.PROPUESTA_ENVIADA, TiposEvento.PROPUESTA_ACEPTADA,
            TiposEvento.PROPUESTA_DESCARTADA, TiposEvento.SOLICITUD_DESASIGNADA,
        ]),
    ).order_by(Evento.fecha).all()

    recibidas: Dict[str, datetime] = {}
    for e in eventos:
        if e.tipo == TiposEvento.SOLICITUD_ASIGNADA and e.cotizacion_id not in recibidas:
            recibidas[e.cotizacion_id] = e.fecha
    for e in todos:
        if e.tipo == TiposEvento.SOLICITUD_DESASIGNADA and e.cotizacion_id in recibidas and e.fecha >= recibidas[e.cotizacion_id]:
            # El admin se la quitó: no era suya para responder.
            recibidas.pop(e.cotizacion_id)

    primera_envio: Dict[str, Evento] = {}
    for e in todos:
        if e.tipo == TiposEvento.PROPUESTA_ENVIADA and e.cotizacion_id not in primera_envio:
            primera_envio[e.cotizacion_id] = e

    enviadas = {
        cid: e for cid, e in primera_envio.items()
        if desde is None or e.fecha >= desde
    }
    propuestas_enviadas = {e.propuesta_id for e in enviadas.values()}
    aceptadas = [e for e in todos if e.tipo == TiposEvento.PROPUESTA_ACEPTADA and e.propuesta_id in propuestas_enviadas]
    descartadas = [e for e in todos if e.tipo == TiposEvento.PROPUESTA_DESCARTADA and e.propuesta_id in propuestas_enviadas]

    respondidas = [cid for cid in recibidas if cid in primera_envio]
    tiempos = [
        (primera_envio[cid].fecha - recibidas[cid]).total_seconds() / 3600
        for cid in respondidas if primera_envio[cid].fecha >= recibidas[cid]
    ]

    valores_cerrados = [v for v in (_en_pesos(e, trm_actual) for e in aceptadas) if v is not None]

    # Propuestas que esperan al comprador: su último monto enviado o editado.
    esperando = db.query(Propuesta).join(Cotizacion, Cotizacion.id == Propuesta.cotizacion_id).filter(
        Propuesta.importador_id == importador_id,
        Propuesta.estado == EstadoPropuesta.pendiente.value,
        Cotizacion.estado.in_(ESTADOS_SIN_CERRAR),
    ).all()
    ultimo_monto: Dict[str, Evento] = {}
    if esperando:
        for e in db.query(Evento).filter(
            Evento.propuesta_id.in_([p.id for p in esperando]),
            Evento.tipo.in_([TiposEvento.PROPUESTA_ENVIADA, TiposEvento.PROPUESTA_EDITADA]),
        ).order_by(Evento.fecha):
            ultimo_monto[e.propuesta_id] = e
    valor_esperando = 0.0
    for p in esperando:
        evento = ultimo_monto.get(p.id)
        valor = _en_pesos(evento, trm_actual) if evento else None
        valor_esperando += valor if valor is not None else float(p.precio_ofrecido_usd or 0) * trm_actual

    etapas = Counter()
    entregados = 0
    for (estado,) in db.query(Orden.estado).filter(Orden.importador_id == importador_id):
        etapa = ETAPA_POR_ESTADO_ORDEN.get(getattr(estado, "value", estado))
        if etapa == "entregado":
            entregados += 1
        elif etapa:
            etapas[etapa] += 1

    motivos = Counter(e.motivo or "sin_motivo" for e in descartadas)
    pendientes = _pendientes(db, importador_id, ahora)

    n_recibidas, n_enviadas, n_aceptadas = len(recibidas), len(propuestas_enviadas), len(aceptadas)
    return {
        "importador_id": importador_id,
        "desde": desde,
        "moneda": "COP",
        "trm": trm_actual,
        "trm_fuente": trm["fuente"],
        "solicitudes_recibidas": n_recibidas,
        "propuestas_enviadas": n_enviadas,
        "propuestas_aceptadas": n_aceptadas,
        "propuestas_descartadas": len(descartadas),
        "propuestas_esperando": len(esperando),
        "conversion_pct": _pct(n_aceptadas, n_enviadas),
        "cierre_uno_de_cada": round(n_enviadas / n_aceptadas, 1) if n_aceptadas else None,
        "tasa_respuesta_pct": _pct(len(respondidas), n_recibidas),
        "tiempo_promedio_respuesta_horas": round(sum(tiempos) / len(tiempos), 1) if tiempos else None,
        "valor_cerrado_cop": round(sum(valores_cerrados), 2),
        "valor_promedio_cerrado_cop": round(sum(valores_cerrados) / len(valores_cerrados), 2) if valores_cerrados else None,
        "valor_esperando_cop": round(valor_esperando, 2),
        "pedidos_por_etapa": {etapa: etapas.get(etapa, 0) for etapa in ETAPAS_PEDIDO},
        "pedidos_entregados": entregados,
        "motivos_perdida": {m: motivos.get(m, 0) for m in (*MOTIVOS_DESCARTE, "sin_motivo")},
        "pendientes_responder": pendientes[:20],
        "total_pendientes_responder": len(pendientes),
    }
