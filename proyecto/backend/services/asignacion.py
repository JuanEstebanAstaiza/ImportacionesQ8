"""Asignación de solicitudes abiertas a empresas importadoras.

En lugar de difundir cada abierta a toda la red (y que compitan por precio),
cada solicitud llega como mucho a `cupo_por_solicitud` empresas (3 por defecto)
elegidas por encaje:

- **categoría** y **país**: la empresa trabaja esa línea y ese origen;
- **pedido mínimo**: la cantidad pedida alcanza el mínimo de la empresa;
- **capacidad**: la cantidad no supera su capacidad declarada;
- **desempeño**: calificación, tasa de respuesta y de cierre, entregas.

En el piloto (`modo = "manual"`) las asigna el admin desde el panel con esa
información a la vista; en modo automático las elige el sistema con el mismo
puntaje. Lo que manda es `recepciones_cotizacion` (entregada=True): una empresa
solo ve, reclama y responde las abiertas que tiene asignadas. Redis solo lleva
el reparto para el contador "X de Y respondieron".
"""
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Set

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.cotizacion import Cotizacion, EstadoCotizacion
from models.importador import Importador
from models.orden import Orden
from models.propuesta import EstadoPropuesta, Propuesta
from models.recepcion_cotizacion import RecepcionCotizacion
from services import configuracion
from utils.categorias import categoria_en, claves_categorias, texto_en


class ErrorAsignacion(Exception):
    def __init__(self, mensaje: str, codigo: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo


ESTADOS_ASIGNABLES = (EstadoCotizacion.abierta.value, EstadoCotizacion.propuestas_recibidas.value)


# ---------- Consultas sobre lo asignado ----------

def asignaciones(db: Session, cotizacion_id: str) -> List[RecepcionCotizacion]:
    return db.query(RecepcionCotizacion).filter(
        RecepcionCotizacion.cotizacion_id == str(cotizacion_id),
        RecepcionCotizacion.entregada.is_(True),
    ).order_by(RecepcionCotizacion.fecha_recepcion).all()


def esta_asignada(db: Session, importador_id: Optional[str], cotizacion_id: str) -> bool:
    if not importador_id:
        return False
    return db.query(RecepcionCotizacion.id).filter(
        RecepcionCotizacion.importador_id == str(importador_id),
        RecepcionCotizacion.cotizacion_id == str(cotizacion_id),
        RecepcionCotizacion.entregada.is_(True),
    ).first() is not None


def cotizaciones_asignadas(db: Session, importador_id: Optional[str]) -> Set[str]:
    if not importador_id:
        return set()
    filas = db.query(RecepcionCotizacion.cotizacion_id).filter(
        RecepcionCotizacion.importador_id == str(importador_id),
        RecepcionCotizacion.entregada.is_(True),
    ).all()
    return {cotizacion_id for (cotizacion_id,) in filas}


def conteo_asignaciones(db: Session, cotizacion_ids: Iterable[str]) -> Dict[str, int]:
    ids = [str(i) for i in cotizacion_ids]
    if not ids:
        return {}
    filas = db.query(RecepcionCotizacion.cotizacion_id, func.count(RecepcionCotizacion.id)).filter(
        RecepcionCotizacion.cotizacion_id.in_(ids),
        RecepcionCotizacion.entregada.is_(True),
    ).group_by(RecepcionCotizacion.cotizacion_id).all()
    return {cotizacion_id: int(total) for cotizacion_id, total in filas}


# ---------- Encaje ----------

def _desempeno(db: Session, importador_ids: List[str]) -> Dict[str, dict]:
    """Indicadores de desempeño por empresa en pocas consultas agrupadas."""
    if not importador_ids:
        return {}

    def contar(consulta) -> Dict[str, int]:
        return {imp: int(total) for imp, total in consulta}

    asignadas = contar(db.query(RecepcionCotizacion.importador_id, func.count(RecepcionCotizacion.id)).filter(
        RecepcionCotizacion.importador_id.in_(importador_ids), RecepcionCotizacion.entregada.is_(True),
    ).group_by(RecepcionCotizacion.importador_id))
    enviadas = contar(db.query(Propuesta.importador_id, func.count(Propuesta.id)).filter(
        Propuesta.importador_id.in_(importador_ids), Propuesta.estado != EstadoPropuesta.borrador.value,
    ).group_by(Propuesta.importador_id))
    aceptadas = contar(db.query(Propuesta.importador_id, func.count(Propuesta.id)).filter(
        Propuesta.importador_id.in_(importador_ids), Propuesta.estado == EstadoPropuesta.aceptada.value,
    ).group_by(Propuesta.importador_id))
    entregadas = contar(db.query(Orden.importador_id, func.count(Orden.id)).filter(
        Orden.importador_id.in_(importador_ids), Orden.estado == "entregado",
    ).group_by(Orden.importador_id))
    activas = contar(db.query(Orden.importador_id, func.count(Orden.id)).filter(
        Orden.importador_id.in_(importador_ids), Orden.estado != "entregado",
    ).group_by(Orden.importador_id))

    resultado = {}
    for imp in importador_ids:
        a, e, ac = asignadas.get(imp, 0), enviadas.get(imp, 0), aceptadas.get(imp, 0)
        resultado[imp] = {
            "solicitudes_asignadas": a,
            "propuestas_enviadas": e,
            "propuestas_aceptadas": ac,
            "tasa_respuesta_pct": round(min(e, a) / a * 100, 1) if a else None,
            "tasa_cierre_pct": round(ac / e * 100, 1) if e else None,
            "pedidos_entregados": entregadas.get(imp, 0),
            "pedidos_activos": activas.get(imp, 0),
        }
    return resultado


def _criterio_pedido_minimo(empresa: Importador, cotizacion: Cotizacion) -> dict:
    minimo = empresa.pedido_minimo
    unidad = empresa.pedido_minimo_unidad or "unidades"
    unidad_cot = getattr(cotizacion, "unidad_cantidad", None) or "unidades"
    if not minimo:
        return {"cumple": True, "detalle": "Sin pedido mínimo"}
    if unidad != unidad_cot:
        return {"cumple": None, "detalle": f"Mínimo {minimo:g} {unidad}; la solicitud está en {unidad_cot}"}
    cumple = float(cotizacion.cantidad_minima) >= float(minimo)
    return {"cumple": cumple, "detalle": f"Mínimo {minimo:g} {unidad}"}


def _criterio_capacidad(empresa: Importador, cotizacion: Cotizacion) -> dict:
    capacidad = empresa.capacidad_volumen
    if not capacidad:
        return {"cumple": None, "detalle": "Capacidad no declarada"}
    cumple = float(cotizacion.cantidad_minima) <= float(capacidad)
    return {"cumple": cumple, "detalle": f"Capacidad {capacidad:,}".replace(",", ".")}


def _puntaje(c: dict) -> float:
    """Orden sugerido: primero lo que encaja, luego el desempeño."""
    puntos = 0.0
    if not c["encaje"]["categoria"] or not c["encaje"]["pais"]:
        puntos -= 100
    for criterio in ("pedido_minimo", "capacidad"):
        cumple = c["encaje"][criterio]["cumple"]
        puntos += 10 if cumple else (-10 if cumple is False else 0)
    if c["cupo_diario_agotado"]:
        puntos -= 50
    d = c["desempeno"]
    puntos += (c["calificacion_promedio"] or 0) * 2
    puntos += (d["tasa_respuesta_pct"] if d["tasa_respuesta_pct"] is not None else 50) / 10
    puntos += (d["tasa_cierre_pct"] or 0) / 20
    puntos += min(d["pedidos_entregados"], 10) / 2
    return round(puntos, 2)


def evaluar_candidatos(db: Session, cotizacion: Cotizacion, *, solo_que_encajan: bool = False) -> List[dict]:
    """Empresas del circuito abierto con su encaje para esta solicitud, mejor puntaje primero."""
    from services.cupo_cotizaciones import cupo_agotado, recibidas_hoy

    empresas = db.query(Importador).filter(
        Importador.estado == "activo",
        Importador.solo_cotizaciones_directas == False,  # noqa: E712
    ).all()
    ids = [str(e.id) for e in empresas]
    desempeno = _desempeno(db, ids)
    hoy = recibidas_hoy(db, ids)
    asignadas = {r.importador_id: r for r in asignaciones(db, cotizacion.id)}
    con_propuesta = {
        imp: estado for imp, estado in db.query(Propuesta.importador_id, Propuesta.estado).filter(
            Propuesta.cotizacion_id == str(cotizacion.id)
        )
    }

    candidatos = []
    for empresa in empresas:
        eid = str(empresa.id)
        categoria = bool(claves_categorias(empresa.especialidad_producto)) and categoria_en(
            cotizacion.linea_producto, empresa.especialidad_producto
        )
        pais = texto_en(cotizacion.pais_importacion, empresa.paises_origen)
        if solo_que_encajan and not (categoria and pais):
            continue
        recepcion = asignadas.get(eid)
        estado_propuesta = con_propuesta.get(eid)
        candidato = {
            "importador_id": eid,
            "nombre_empresa": empresa.nombre_empresa,
            "logo_url": empresa.logo_url,
            "verificado": bool(empresa.verificado),
            "especialidades": empresa.especialidad_producto or [],
            "paises_origen": empresa.paises_origen or [],
            "calificacion_promedio": float(empresa.calificacion_promedio or 0),
            "tiempo_respuesta_promedio": empresa.tiempo_respuesta_promedio,
            "pedido_minimo": empresa.pedido_minimo,
            "pedido_minimo_unidad": empresa.pedido_minimo_unidad,
            "capacidad_volumen": empresa.capacidad_volumen,
            "limite_cotizaciones_diarias": empresa.limite_cotizaciones_diarias,
            "recibidas_hoy": hoy.get(eid, 0),
            "cupo_diario_agotado": cupo_agotado(empresa.limite_cotizaciones_diarias, hoy.get(eid, 0)),
            "encaje": {
                "categoria": categoria,
                "pais": pais,
                "pedido_minimo": _criterio_pedido_minimo(empresa, cotizacion),
                "capacidad": _criterio_capacidad(empresa, cotizacion),
            },
            "desempeno": desempeno.get(eid, {}),
            "asignada": recepcion is not None,
            "origen_asignacion": recepcion.origen if recepcion else None,
            "fecha_asignacion": recepcion.fecha_recepcion if recepcion else None,
            "estado_propuesta": getattr(estado_propuesta, "value", estado_propuesta),
        }
        candidato["puntaje"] = _puntaje(candidato)
        candidatos.append(candidato)

    candidatos.sort(key=lambda c: (not c["asignada"], -c["puntaje"], c["nombre_empresa"].lower()))
    return candidatos


# ---------- Asignar y quitar ----------

def _ttl_restante(cotizacion: Cotizacion, ahora: Optional[datetime] = None) -> int:
    from config import COTIZACION_ABIERTA_TTL

    ahora = ahora or datetime.utcnow()
    creada = cotizacion.fecha_creacion or ahora
    return max(int((creada + timedelta(seconds=COTIZACION_ABIERTA_TTL) - ahora).total_seconds()), 3600)


def publicar_en_redis(cotizacion: Cotizacion, importador_ids: List[str]) -> None:
    """Añade empresas al reparto de Redis (contador de respuestas). Best-effort."""
    from services.matching_service import _get_redis_client, _indexar_matching, _redis_available

    if not importador_ids or not _redis_available():
        return
    client = _get_redis_client()
    clave = f"cotizacion_abierta:{cotizacion.id}"
    ttl = _ttl_restante(cotizacion)
    try:
        client.hset(clave, mapping={imp: "pendiente" for imp in importador_ids})
        client.expire(clave, ttl)
        client.setex(f"{clave}:expiracion", ttl, str(datetime.utcnow() + timedelta(seconds=ttl)))
        _indexar_matching(client, str(cotizacion.id), importador_ids)
    except Exception:
        pass


def _retirar_de_redis(cotizacion_id: str, importador_id: str) -> None:
    from config import indice_importador_abiertas
    from services.matching_service import _get_redis_client, _redis_available

    if not _redis_available():
        return
    client = _get_redis_client()
    try:
        client.hdel(f"cotizacion_abierta:{cotizacion_id}", importador_id)
        client.srem(indice_importador_abiertas(importador_id), cotizacion_id)
    except Exception:
        pass


def asignar(db: Session, cotizacion: Cotizacion, importador_ids: List[str], *, admin: dict) -> List[str]:
    """Asigna la solicitud a esas empresas (sin commit). Devuelve las que se añadieron.

    Reglas: solicitud abierta y vigente; empresa activa, del circuito abierto,
    que trabaje la categoría (si no, no podría responder) y sin el cupo diario
    agotado; y entre todas no pasar del cupo por solicitud.
    """
    from services.cupo_cotizaciones import cupo_agotado, recibidas_hoy, registrar_recepcion

    if cotizacion.modalidad != "abierta":
        raise ErrorAsignacion("Solo se asignan las solicitudes abiertas; las dirigidas ya tienen su empresa")
    estado = getattr(cotizacion.estado, "value", cotizacion.estado)
    if estado not in ESTADOS_ASIGNABLES:
        raise ErrorAsignacion("La solicitud ya no admite propuestas (cerrada o cancelada)", 409)

    pedidas = list(dict.fromkeys(str(i) for i in importador_ids))
    if not pedidas:
        raise ErrorAsignacion("Indica al menos una empresa")

    ya = {r.importador_id for r in asignaciones(db, cotizacion.id)}
    nuevas = [i for i in pedidas if i not in ya]
    cupo = configuracion.cupo_por_solicitud(db)
    if len(ya) + len(nuevas) > cupo:
        libres = max(cupo - len(ya), 0)
        raise ErrorAsignacion(
            f"Cada solicitud llega a máximo {cupo} empresas. Ya tiene {len(ya)} asignadas; "
            f"puedes añadir {libres}.",
            409,
        )

    empresas = {str(e.id): e for e in db.query(Importador).filter(Importador.id.in_(nuevas)).all()}
    hoy = recibidas_hoy(db, nuevas)
    for importador_id in nuevas:
        empresa = empresas.get(importador_id)
        if empresa is None or empresa.estado != "activo":
            raise ErrorAsignacion("Empresa no encontrada o inactiva", 404)
        if empresa.solo_cotizaciones_directas:
            raise ErrorAsignacion(f"{empresa.nombre_empresa} solo recibe cotizaciones dirigidas")
        if not categoria_en(cotizacion.linea_producto, empresa.especialidad_producto):
            raise ErrorAsignacion(
                f"{empresa.nombre_empresa} no trabaja la categoría '{cotizacion.linea_producto}': no podría responderla"
            )
        if cupo_agotado(empresa.limite_cotizaciones_diarias, hoy.get(importador_id, 0)):
            raise ErrorAsignacion(f"{empresa.nombre_empresa} ya alcanzó hoy su límite de cotizaciones", 409)

    for importador_id in nuevas:
        omitida = db.query(RecepcionCotizacion).filter(
            RecepcionCotizacion.importador_id == importador_id,
            RecepcionCotizacion.cotizacion_id == str(cotizacion.id),
        ).first()
        if omitida is not None:
            # El reparto automático la había saltado por cupo: ahora sí le llega.
            db.delete(omitida)
            db.flush()
        registrar_recepcion(
            db, importador_id=importador_id, cotizacion_id=str(cotizacion.id),
            modalidad="abierta", origen="manual", asignado_por=admin,
        )
    return nuevas


def desasignar(db: Session, cotizacion: Cotizacion, importador_id: str, *, admin: dict) -> None:
    """Quita la asignación (sin commit) si la empresa todavía no envió propuesta."""
    from services.eventos import TiposEvento, evento_solicitud

    recepcion = db.query(RecepcionCotizacion).filter(
        RecepcionCotizacion.importador_id == str(importador_id),
        RecepcionCotizacion.cotizacion_id == str(cotizacion.id),
        RecepcionCotizacion.entregada.is_(True),
    ).first()
    if recepcion is None:
        raise ErrorAsignacion("Esa empresa no tiene asignada esta solicitud", 404)
    propuesta = db.query(Propuesta.id).filter(
        Propuesta.cotizacion_id == str(cotizacion.id),
        Propuesta.importador_id == str(importador_id),
        Propuesta.estado != EstadoPropuesta.borrador.value,
    ).first()
    if propuesta:
        raise ErrorAsignacion("La empresa ya envió su propuesta; no se puede quitar la asignación", 409)

    db.delete(recepcion)
    evento_solicitud(db, TiposEvento.SOLICITUD_DESASIGNADA, cotizacion, importador_id=str(importador_id), usuario=admin)
    _retirar_de_redis(str(cotizacion.id), str(importador_id))


def elegir_automaticamente(db: Session, cotizacion: Cotizacion, candidatas: List[Importador]) -> List[Importador]:
    """Modo automático: las `cupo` empresas con mejor encaje entre las candidatas."""
    cupo = configuracion.cupo_por_solicitud(db)
    if len(candidatas) <= cupo:
        return candidatas
    ids = {str(e.id) for e in candidatas}
    ranking = [c["importador_id"] for c in evaluar_candidatos(db, cotizacion, solo_que_encajan=True) if c["importador_id"] in ids]
    por_id = {str(e.id): e for e in candidatas}
    return [por_id[i] for i in ranking[:cupo]]
