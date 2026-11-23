"""Pedidos de fabricación: muestra, producción por etapas, pagos por hitos y entrega.

Ciclo:
- `muestra`: la maquiladora envía la muestra (si hay anticipo, después de que se
  confirme); el cliente la aprueba o pide ajustes, y cada ajuste es una ronda nueva.
- `produccion`: con la muestra aprobada (y el pago contra muestra confirmado, si lo
  hay), la maquiladora completa las etapas en orden, con nota y fotos. La etapa de
  control de calidad se cierra con un reporte de inspección (contra el checklist
  acordado en la propuesta) que el cliente aprueba u objeta. El despacho exige
  confirmados todos los pagos menos el de contra entrega.
- `despachado` → `entregado`: el cliente confirma que lo recibió; ahí puede calificar
  a la maquila (`resenas.py`) y repetir el pedido.
- `cancelado`: cualquiera de las partes, mientras el pedido está en la muestra.

Pagos: Zarpi no recibe el dinero. Cada hito pasa por `pendiente` → `enviado` (el
cliente subió el comprobante) → `confirmado` o `rechazado` (lo decide la maquiladora).
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, List, Optional

from fastapi import status
from pymongo import ReturnDocument
from pymongo.database import Database
from sqlalchemy.orm import Session

from maquilas import acceso, archivos, avisos, chat, parametros, resenas
from maquilas.comun import ahora, codigo, error, iso, nuevo_id
from maquilas.esquemas import (
    ComprobanteEntrada, EtapaEntrada, MuestraEntrada, ReporteCalidadEntrada, RespuestaCalidadEntrada, RespuestaMuestraEntrada,
)
from maquilas.identidad import es_maquiladora, maquiladora_id_de

ETIQUETAS = {
    "muestra": "Muestra",
    "produccion": "En producción",
    "despachado": "Despachado",
    "entregado": "Entregado",
    "cancelado": "Cancelado",
}
ESTADOS_ACTIVOS = ("muestra", "produccion")
# La etapa que se cierra con el reporte de calidad aprobado (si el admin la deja en las etapas).
ETAPA_CALIDAD = "control_calidad"


# ── Creación (al aceptar una propuesta) ─────────────────────────────────────

def crear(db: Database, sql: Session, solicitud: Dict, propuesta: Dict, usuario: dict) -> Dict:
    from maquilas.solicitudes import montos_hitos, precio_para

    precio = precio_para(propuesta["tramos"], solicitud["cantidad"]) or 0
    total = precio * solicitud["cantidad"] + int(propuesta.get("costo_muestra") or 0)
    maquiladora = db.maquiladoras.find_one({"_id": propuesta["maquiladora_id"]}, {"nombre_comercial": 1, "ciudad": 1}) or {}
    momento = ahora()
    pedido_id = nuevo_id()
    doc = {
        "_id": pedido_id,
        "codigo": codigo("PM", pedido_id),
        "solicitud_id": solicitud["_id"],
        "propuesta_id": propuesta["_id"],
        "hilo": chat.hilo_de(solicitud["_id"], propuesta["maquiladora_id"]),
        "cuenta_cliente": solicitud["cuenta_cliente"],
        "cliente": solicitud.get("cliente") or {},
        "maquiladora_id": propuesta["maquiladora_id"],
        "maquiladora": {"nombre_comercial": maquiladora.get("nombre_comercial"), "ciudad": maquiladora.get("ciudad")},
        "producto": solicitud["titulo"],
        "categoria": solicitud["categoria"],
        "cantidad": solicitud["cantidad"],
        "precio_unitario": precio,
        "costo_muestra": int(propuesta.get("costo_muestra") or 0),
        "total": total,
        "dias_muestra": propuesta["dias_muestra"],
        "dias_produccion": propuesta["dias_produccion"],
        "fecha_compromiso": momento + timedelta(days=propuesta["dias_muestra"] + propuesta["dias_produccion"]),
        "condiciones": propuesta.get("condiciones") or "",
        "estado": "muestra",
        "muestras": [],
        "etapas": [{"clave": e["clave"], "nombre": e["nombre"], "estado": "pendiente", "completada_en": None,
                    "nota": "", "fotos": []} for e in parametros.leer(db)["etapas"]],
        "hitos": [{**h, "estado": "pendiente", "comprobantes": [], "motivo_rechazo": None, "confirmado_en": None}
                  for h in montos_hitos(propuesta["hitos"], total, db)],
        "calidad": {"criterios": propuesta.get("criterios_calidad") or [], "reportes": []},
        "producto_mb_id": (solicitud.get("producto") or {}).get("id"),
        "creado_por": usuario["user_id"],
        "creado_en": momento,
        "actualizado_en": momento,
    }
    db.pedidos.insert_one(doc)
    if doc["producto_mb_id"]:
        db.productos_mb.update_one({"_id": doc["producto_mb_id"]}, {"$inc": {"pedidos": 1}})
    return doc


# ── Reglas que bloquean el avance ────────────────────────────────────────────

def _hito(pedido: Dict, clave: str) -> Optional[Dict]:
    return next((h for h in pedido.get("hitos") or [] if h["clave"] == clave), None)


def _hito_pagado(pedido: Dict, clave: str) -> bool:
    hito = _hito(pedido, clave)
    return hito is None or hito["estado"] == "confirmado"


def _muestra_vigente(pedido: Dict) -> Optional[Dict]:
    return (pedido.get("muestras") or [None])[-1]


def _siguiente_etapa(pedido: Dict) -> Optional[Dict]:
    return next((e for e in pedido["etapas"] if e["estado"] != "hecha"), None)


def _reporte_vigente(pedido: Dict) -> Optional[Dict]:
    return ((pedido.get("calidad") or {}).get("reportes") or [None])[-1]


def _en_calidad(pedido: Dict) -> bool:
    siguiente = _siguiente_etapa(pedido)
    return pedido["estado"] == "produccion" and bool(siguiente) and siguiente["clave"] == ETAPA_CALIDAD


def bloqueo_muestra(pedido: Dict) -> Optional[str]:
    if pedido["estado"] != "muestra":
        return "El pedido ya no está en la etapa de muestra"
    if not _hito_pagado(pedido, "anticipo"):
        return "Esperando que se confirme el anticipo"
    vigente = _muestra_vigente(pedido)
    if vigente and vigente["estado"] == "enviada":
        return "El cliente todavía está revisando la muestra enviada"
    return None


def bloqueo_etapa(pedido: Dict) -> Optional[str]:
    if pedido["estado"] == "muestra":
        return "Primero el cliente tiene que aprobar la muestra"
    if pedido["estado"] != "produccion":
        return "El pedido no está en producción"
    if not _hito_pagado(pedido, "contra_muestra"):
        return "Esperando que se confirme el pago contra muestra"
    siguiente = _siguiente_etapa(pedido)
    if siguiente and siguiente["clave"] == "despacho":
        pendientes = [h["nombre"] for h in pedido["hitos"] if h["clave"] != "contra_entrega" and h["estado"] != "confirmado"]
        if pendientes:
            return "Antes de despachar se confirman estos pagos: " + ", ".join(pendientes)
    return None


def bloqueo_calidad(pedido: Dict) -> Optional[str]:
    """Por qué la maquila no puede subir el reporte de calidad ahora (None si puede)."""
    if not _en_calidad(pedido):
        return "El reporte de calidad se sube cuando el pedido llega a esa etapa"
    motivo = bloqueo_etapa(pedido)
    if motivo:
        return motivo
    vigente = _reporte_vigente(pedido)
    if vigente and vigente["estado"] == "enviado":
        return "El cliente todavía está revisando el reporte de calidad"
    return None


def aviso_para(pedido: Dict, lado: str) -> Optional[str]:
    """Qué está frenando el pedido, dicho a quien mira: qué le toca hacer o a quién espera."""
    def pago(clave: str) -> Optional[str]:
        hito = _hito(pedido, clave)
        if not hito or hito["estado"] == "confirmado":
            return None
        if lado == "cliente":
            return (f"La maquila está revisando tu comprobante de «{hito['nombre']}»." if hito["estado"] == "enviado"
                    else f"Sube el comprobante de «{hito['nombre']}» ({hito['porcentaje']} %) para seguir.")
        return (f"Revisa el comprobante de «{hito['nombre']}» que subió el cliente." if hito["estado"] == "enviado"
                else f"Esperando el pago «{hito['nombre']}» del cliente.")

    if pedido["estado"] == "muestra":
        if pago("anticipo"):
            return pago("anticipo")
        vigente = _muestra_vigente(pedido)
        if vigente and vigente["estado"] == "enviada":
            return "Revisa la muestra y apruébala o pide ajustes." if lado == "cliente" else "El cliente está revisando la muestra."
        if lado == "cliente":
            return "La maquila está preparando la muestra." if not vigente else "La maquila está haciendo los ajustes a la muestra."
        return "Envía la muestra al cliente." if not vigente else "Envía la muestra con los ajustes que pidió el cliente."
    if pedido["estado"] == "produccion":
        if pago("contra_muestra"):
            return pago("contra_muestra")
        if _en_calidad(pedido):
            vigente = _reporte_vigente(pedido)
            if vigente and vigente["estado"] == "enviado":
                return ("Revisa el reporte de calidad y apruébalo u objétalo." if lado == "cliente"
                        else "El cliente está revisando el reporte de calidad.")
            if lado == "cliente":
                return "La maquila está inspeccionando el lote para enviarte el reporte de calidad."
            return ("Corrige lo que objetó el cliente y sube un nuevo reporte de calidad." if vigente
                    else "Inspecciona el lote y sube el reporte de calidad.")
        siguiente = _siguiente_etapa(pedido)
        if siguiente and siguiente["clave"] == "despacho":
            for h in pedido["hitos"]:
                if h["clave"] != "contra_entrega" and pago(h["clave"]):
                    return pago(h["clave"])
        return None
    if pedido["estado"] == "despachado" and lado == "cliente":
        return "Cuando recibas el pedido, confírmalo con «Ya lo recibí»."
    return None


# ── Serialización ────────────────────────────────────────────────────────────

def a_pedido(db: Database, doc: Dict, usuario: dict) -> Dict:
    lado = "maquiladora" if es_maquiladora(usuario) else ("cliente" if acceso.cuenta_cliente(usuario) else "equipo")
    siguiente = _siguiente_etapa(doc)
    activo = doc["estado"] in ESTADOS_ACTIVOS
    retrasado = activo and doc.get("fecha_compromiso") and doc["fecha_compromiso"] < ahora()
    vigente = _muestra_vigente(doc)
    reporte = _reporte_vigente(doc)
    resena = resenas.de_pedido(db, doc["_id"])
    acciones: Dict[str, Any] = {}
    if lado == "maquiladora":
        acciones = {
            "enviar_muestra": bloqueo_muestra(doc) is None,
            "completar_etapa": (siguiente["clave"] if siguiente and siguiente["clave"] != ETAPA_CALIDAD
                                and doc["estado"] == "produccion" and bloqueo_etapa(doc) is None else None),
            "enviar_reporte_calidad": bloqueo_calidad(doc) is None,
            "revisar_comprobantes": [h["clave"] for h in doc["hitos"] if h["estado"] == "enviado"],
            "responder_resena": bool(resena) and not resena.get("respuesta"),
            "cancelar": doc["estado"] == "muestra",
        }
    elif lado == "cliente":
        acciones = {
            "responder_muestra": bool(vigente) and vigente["estado"] == "enviada" and doc["estado"] == "muestra",
            "responder_calidad": _en_calidad(doc) and bool(reporte) and reporte["estado"] == "enviado",
            "subir_comprobante": [h["clave"] for h in doc["hitos"] if h["estado"] in ("pendiente", "rechazado")
                                  and doc["estado"] != "cancelado"],
            "marcar_recibido": doc["estado"] == "despachado",
            "resenar": doc["estado"] == "entregado" and not resena,
            "repetir": doc["estado"] == "entregado",
            "cancelar": doc["estado"] == "muestra",
        }
    calidad = doc.get("calidad") or {"criterios": [], "reportes": []}
    pagado = sum(h["monto"] for h in doc["hitos"] if h["estado"] == "confirmado")
    return {
        "id": doc["_id"],
        "codigo": doc["codigo"],
        "solicitud_id": doc["solicitud_id"],
        "hilo": doc["hilo"],
        "lado": lado,
        "estado": doc["estado"],
        "estado_etiqueta": ETIQUETAS.get(doc["estado"], doc["estado"]),
        "producto": doc["producto"],
        "categoria": doc["categoria"],
        "cantidad": doc["cantidad"],
        "precio_unitario": doc["precio_unitario"],
        "costo_muestra": doc["costo_muestra"],
        "total": doc["total"],
        "pagado": pagado,
        "dias_muestra": doc["dias_muestra"],
        "dias_produccion": doc["dias_produccion"],
        "condiciones": doc.get("condiciones") or "",
        "fecha_compromiso": iso(doc.get("fecha_compromiso")),
        "retrasado": bool(retrasado),
        "cliente": doc.get("cliente") or {},
        "maquiladora": {"id": doc["maquiladora_id"], **(doc.get("maquiladora") or {})},
        "muestras": [{**m, "archivos": [archivos.con_url(a) for a in m.get("archivos") or []],
                      "enviada_en": iso(m.get("enviada_en")), "respondida_en": iso(m.get("respondida_en"))}
                     for m in doc.get("muestras") or []],
        "etapas": [{**e, "fotos": [archivos.con_url(f) for f in e.get("fotos") or []],
                    "completada_en": iso(e.get("completada_en"))} for e in doc["etapas"]],
        "etapa_siguiente": siguiente["clave"] if siguiente else None,
        "hitos": [{**h, "comprobantes": [{**c, "archivo": archivos.con_url(c.get("archivo")), "subido_en": iso(c.get("subido_en"))}
                                         for c in h.get("comprobantes") or []],
                   "confirmado_en": iso(h.get("confirmado_en"))} for h in doc["hitos"]],
        "calidad": {
            "criterios": calidad.get("criterios") or [],
            "reportes": [{**r, "fotos": [archivos.con_url(f) for f in r.get("fotos") or []], "enviado_en": iso(r.get("enviado_en")),
                          "respondido_en": iso(r.get("respondido_en"))} for r in calidad.get("reportes") or []],
            "etapa": any(e["clave"] == ETAPA_CALIDAD for e in doc["etapas"]),
        },
        "resena": resenas.a_resena(resena) if resena else None,
        "producto_mb_id": doc.get("producto_mb_id"),
        "acciones": acciones,
        "bloqueo": aviso_para(doc, lado) if lado in ("cliente", "maquiladora") else None,
        "creado_en": iso(doc.get("creado_en")),
        "entregado_en": iso(doc.get("entregado_en")),
        "cancelacion": ({**doc["cancelacion"], "en": iso(doc["cancelacion"].get("en"))} if doc.get("cancelacion") else None),
    }


def _resumen(db: Database, doc: Dict, usuario: dict) -> Dict:
    completo = a_pedido(db, doc, usuario)
    hechas = sum(1 for e in doc["etapas"] if e["estado"] == "hecha")
    return {k: completo[k] for k in ("id", "codigo", "lado", "estado", "estado_etiqueta", "producto", "cantidad", "total", "pagado",
                                     "fecha_compromiso", "retrasado", "cliente", "maquiladora", "creado_en", "bloqueo")} | {
        "etapas_hechas": hechas, "etapas_total": len(doc["etapas"]),
        # ¿Le toca hacer algo a quien mira? (cancelar no cuenta: siempre está disponible al principio).
        "pendiente_de_mi": any(v for k, v in completo["acciones"].items() if k != "cancelar"),
    }


# ── Consultas ────────────────────────────────────────────────────────────────

def listar(db: Database, usuario: dict) -> List[Dict]:
    if es_maquiladora(usuario):
        filtro = {"maquiladora_id": maquiladora_id_de(db, usuario)}
    else:
        cuenta = acceso.cuenta_cliente(usuario)
        if not cuenta:
            raise error(status.HTTP_403_FORBIDDEN, "No tienes pedidos")
        filtro = {"cuenta_cliente": cuenta}
    return [_resumen(db, doc, usuario) for doc in db.pedidos.find(filtro).sort("creado_en", -1).limit(200)]


def _pedido(db: Database, usuario: dict, pedido_id: str, *, incluir_equipo: bool = True) -> Dict:
    doc = db.pedidos.find_one({"_id": pedido_id})
    if not doc or not acceso.es_parte_del_pedido(db, doc, usuario, incluir_equipo=incluir_equipo):
        raise error(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    return doc


def detalle(db: Database, usuario: dict, pedido_id: str) -> Dict:
    return a_pedido(db, _pedido(db, usuario, pedido_id), usuario)


# ── Acciones ─────────────────────────────────────────────────────────────────

def _solo(lado: str, usuario: dict) -> None:
    es_maq = es_maquiladora(usuario)
    if (lado == "maquiladora") != es_maq:
        raise error(status.HTTP_403_FORBIDDEN, "Esta acción le corresponde a " + ("la maquila" if lado == "maquiladora" else "el cliente"))


def _avisar_otro_lado(db: Database, sql: Session, pedido: Dict, a: str, *, tipo: str, titulo: str, mensaje: str, correo: bool = False) -> None:
    usuarios = (avisos.usuarios_de_maquiladora(db, pedido["maquiladora_id"]) if a == "maquiladora"
                else avisos.usuarios_de_cliente(sql, pedido["cuenta_cliente"]))
    avisos.avisar(sql, usuarios, tipo=tipo, titulo=titulo, mensaje=mensaje,
                  data={"evento": tipo, "pedido_id": pedido["_id"], "lado_destino": a}, correo=correo)


def _guardar(db: Database, pedido_id: str, filtro_extra: Dict, cambios: Dict) -> Dict:
    actualizado = db.pedidos.find_one_and_update({"_id": pedido_id, **filtro_extra},
                                                 {**cambios, "$set": {**cambios.get("$set", {}), "actualizado_en": ahora()}},
                                                 return_document=ReturnDocument.AFTER)
    if not actualizado:
        raise error(status.HTTP_409_CONFLICT, "El pedido cambió mientras tanto. Recarga e intenta de nuevo.")
    return actualizado


def enviar_muestra(db: Database, sql: Session, usuario: dict, pedido_id: str, datos: MuestraEntrada) -> Dict:
    _solo("maquiladora", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    motivo = bloqueo_muestra(pedido)
    if motivo:
        raise error(status.HTTP_409_CONFLICT, motivo)
    try:
        refs = archivos.ligar(db, ids=datos.archivos, tipo="muestra", cuenta=f"maquiladora:{pedido['maquiladora_id']}",
                              contexto={"pedido_id": pedido_id})
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    ronda = len(pedido.get("muestras") or []) + 1
    muestra = {"ronda": ronda, "archivos": refs, "nota": datos.nota.strip(), "estado": "enviada", "enviada_en": ahora(),
               "comentario": "", "respondida_en": None}
    actualizado = _guardar(db, pedido_id, {"estado": "muestra", "muestras": {"$size": ronda - 1}},
                           {"$push": {"muestras": muestra}})
    chat.sistema(db, pedido["hilo"], f"La maquila envió la muestra (ronda {ronda}).")
    _avisar_otro_lado(db, sql, pedido, "cliente", tipo="maquila_muestra", titulo="Tu muestra está lista para revisar",
                      mensaje=f"{pedido['producto']}: revisa la muestra (ronda {ronda}) y apruébala o pide ajustes.", correo=True)
    return a_pedido(db, actualizado, usuario)


def responder_muestra(db: Database, sql: Session, usuario: dict, pedido_id: str, datos: RespuestaMuestraEntrada) -> Dict:
    _solo("cliente", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    vigente = _muestra_vigente(pedido)
    if pedido["estado"] != "muestra" or not vigente or vigente["estado"] != "enviada":
        raise error(status.HTTP_409_CONFLICT, "No hay una muestra esperando tu respuesta")
    comentario = datos.comentario.strip()
    if not datos.aprobada and len(comentario) < 5:
        raise error(status.HTTP_400_BAD_REQUEST, "Cuéntale a la maquila qué ajustar")
    indice = len(pedido["muestras"]) - 1
    cambios = {f"muestras.{indice}.estado": "aprobada" if datos.aprobada else "ajustes",
               f"muestras.{indice}.comentario": comentario, f"muestras.{indice}.respondida_en": ahora()}
    if datos.aprobada:
        cambios["estado"] = "produccion"
        cambios["etapas.0.estado"] = "en_curso"
    actualizado = _guardar(db, pedido_id, {"estado": "muestra", f"muestras.{indice}.estado": "enviada"}, {"$set": cambios})
    if datos.aprobada:
        chat.sistema(db, pedido["hilo"], f"El cliente aprobó la muestra (ronda {vigente['ronda']}). Arranca la producción.")
        _avisar_otro_lado(db, sql, pedido, "maquiladora", tipo="maquila_muestra_aprobada", titulo="Aprobaron la muestra",
                          mensaje=f"{pedido['producto']}: ya puedes arrancar la producción.", correo=True)
    else:
        chat.sistema(db, pedido["hilo"], f"El cliente pidió ajustes a la muestra (ronda {vigente['ronda']}): {comentario}")
        _avisar_otro_lado(db, sql, pedido, "maquiladora", tipo="maquila_muestra_ajustes", titulo="Piden ajustes a la muestra",
                          mensaje=f"{pedido['producto']}: {comentario}", correo=True)
    return a_pedido(db, actualizado, usuario)


def completar_etapa(db: Database, sql: Session, usuario: dict, pedido_id: str, clave: str, datos: EtapaEntrada) -> Dict:
    _solo("maquiladora", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    motivo = bloqueo_etapa(pedido)
    if motivo:
        raise error(status.HTTP_409_CONFLICT, motivo)
    siguiente = _siguiente_etapa(pedido)
    if not siguiente or siguiente["clave"] != clave:
        raise error(status.HTTP_409_CONFLICT, "Las etapas se completan en orden")
    if clave == ETAPA_CALIDAD:
        raise error(status.HTTP_409_CONFLICT, "Esta etapa se cierra cuando el cliente aprueba el reporte de calidad")
    try:
        fotos = archivos.ligar(db, ids=datos.fotos, tipo="evidencia", cuenta=f"maquiladora:{pedido['maquiladora_id']}",
                               contexto={"pedido_id": pedido_id})
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    indice = next(i for i, e in enumerate(pedido["etapas"]) if e["clave"] == clave)
    cambios: Dict[str, Any] = {f"etapas.{indice}.estado": "hecha", f"etapas.{indice}.completada_en": ahora(),
                               f"etapas.{indice}.nota": datos.nota.strip(), f"etapas.{indice}.fotos": fotos}
    ultima = indice == len(pedido["etapas"]) - 1
    if ultima:
        cambios["estado"] = "despachado"
    else:
        cambios[f"etapas.{indice + 1}.estado"] = "en_curso"
    actualizado = _guardar(db, pedido_id, {"estado": "produccion", f"etapas.{indice}.estado": {"$ne": "hecha"}}, {"$set": cambios})
    chat.sistema(db, pedido["hilo"], f"Etapa completada: {siguiente['nombre']}." + (f" {datos.nota.strip()}" if datos.nota.strip() else ""))
    _avisar_otro_lado(db, sql, pedido, "cliente",
                      tipo="maquila_despachado" if ultima else "maquila_etapa",
                      titulo="Tu pedido va en camino" if ultima else f"Avanzó tu pedido: {siguiente['nombre']}",
                      mensaje=f"{pedido['producto']} ({pedido['codigo']})", correo=ultima)
    return a_pedido(db, actualizado, usuario)


def enviar_reporte_calidad(db: Database, sql: Session, usuario: dict, pedido_id: str, datos: ReporteCalidadEntrada) -> Dict:
    _solo("maquiladora", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    motivo = bloqueo_calidad(pedido)
    if motivo:
        raise error(status.HTTP_409_CONFLICT, motivo)
    criterios = (pedido.get("calidad") or {}).get("criterios") or []
    if len(datos.resultados) != len(criterios):
        raise error(status.HTTP_400_BAD_REQUEST, "Marca el resultado de cada criterio del checklist")
    if datos.unidades_inspeccionadas > pedido["cantidad"]:
        raise error(status.HTTP_400_BAD_REQUEST, "No puedes inspeccionar más unidades de las del pedido")
    try:
        fotos = archivos.ligar(db, ids=datos.fotos, tipo="evidencia", cuenta=f"maquiladora:{pedido['maquiladora_id']}",
                               contexto={"pedido_id": pedido_id})
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    reportes = (pedido.get("calidad") or {}).get("reportes") or []
    ronda = len(reportes) + 1
    resultados = [{"criterio": c["criterio"], "tolerancia": c.get("tolerancia") or "", "cumple": r.cumple,
                   "observacion": r.observacion.strip()} for c, r in zip(criterios, datos.resultados)]
    reporte = {"ronda": ronda, "unidades_inspeccionadas": datos.unidades_inspeccionadas, "resultados": resultados,
               "fotos": fotos, "nota": datos.nota.strip(), "estado": "enviado", "enviado_en": ahora(),
               "comentario": "", "respondido_en": None}
    filtro = {"estado": "produccion", "calidad.reportes": {"$size": ronda - 1}} if pedido.get("calidad") else {"estado": "produccion"}
    cambios = {"$push": {"calidad.reportes": reporte}}
    if not pedido.get("calidad"):  # pedidos de antes de la fase 3
        cambios = {"$set": {"calidad": {"criterios": [], "reportes": [reporte]}}}
    actualizado = _guardar(db, pedido_id, filtro, cambios)
    no_cumplen = sum(1 for r in resultados if not r["cumple"])
    chat.sistema(db, pedido["hilo"], f"La maquila envió el reporte de calidad (ronda {ronda}): "
                 f"{datos.unidades_inspeccionadas} unidades inspeccionadas" + (f", {no_cumplen} criterio(s) sin cumplir." if no_cumplen else "."))
    _avisar_otro_lado(db, sql, pedido, "cliente", tipo="maquila_calidad", titulo="Revisa el reporte de calidad",
                      mensaje=f"{pedido['producto']}: apruébalo para que la maquila empaque y despache.", correo=True)
    return a_pedido(db, actualizado, usuario)


def responder_calidad(db: Database, sql: Session, usuario: dict, pedido_id: str, datos: RespuestaCalidadEntrada) -> Dict:
    _solo("cliente", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    reporte = _reporte_vigente(pedido)
    if not _en_calidad(pedido) or not reporte or reporte["estado"] != "enviado":
        raise error(status.HTTP_409_CONFLICT, "No hay un reporte de calidad esperando tu respuesta")
    comentario = datos.comentario.strip()
    if not datos.aprobado and len(comentario) < 5:
        raise error(status.HTTP_400_BAD_REQUEST, "Cuéntale a la maquila qué no cumple")
    i = len(pedido["calidad"]["reportes"]) - 1
    cambios: Dict[str, Any] = {f"calidad.reportes.{i}.estado": "aprobado" if datos.aprobado else "objetado",
                               f"calidad.reportes.{i}.comentario": comentario, f"calidad.reportes.{i}.respondido_en": ahora()}
    if datos.aprobado:
        indice = next(j for j, e in enumerate(pedido["etapas"]) if e["clave"] == ETAPA_CALIDAD)
        cambios.update({f"etapas.{indice}.estado": "hecha", f"etapas.{indice}.completada_en": ahora(),
                        f"etapas.{indice}.nota": f"Reporte de calidad aprobado (ronda {reporte['ronda']})",
                        f"etapas.{indice}.fotos": reporte.get("fotos") or []})
        if indice == len(pedido["etapas"]) - 1:
            cambios["estado"] = "despachado"
        else:
            cambios[f"etapas.{indice + 1}.estado"] = "en_curso"
    actualizado = _guardar(db, pedido_id, {"estado": "produccion", f"calidad.reportes.{i}.estado": "enviado"}, {"$set": cambios})
    if datos.aprobado:
        chat.sistema(db, pedido["hilo"], f"El cliente aprobó el reporte de calidad (ronda {reporte['ronda']}).")
        _avisar_otro_lado(db, sql, pedido, "maquiladora", tipo="maquila_calidad_aprobada", titulo="Aprobaron el reporte de calidad",
                          mensaje=f"{pedido['producto']}: sigue con el empaque y el despacho.", correo=True)
    else:
        chat.sistema(db, pedido["hilo"], f"El cliente objetó el reporte de calidad (ronda {reporte['ronda']}): {comentario}")
        _avisar_otro_lado(db, sql, pedido, "maquiladora", tipo="maquila_calidad_objetada", titulo="El cliente objetó el reporte de calidad",
                          mensaje=f"{pedido['producto']}: {comentario}", correo=True)
    return a_pedido(db, actualizado, usuario)


def subir_comprobante(db: Database, sql: Session, usuario: dict, pedido_id: str, clave: str, datos: ComprobanteEntrada) -> Dict:
    _solo("cliente", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    hito = _hito(pedido, clave)
    if not hito:
        raise error(status.HTTP_404_NOT_FOUND, "Ese pago no existe en el pedido")
    if pedido["estado"] == "cancelado" or hito["estado"] not in ("pendiente", "rechazado"):
        raise error(status.HTTP_409_CONFLICT, "Este pago ya tiene un comprobante en revisión o está confirmado")
    try:
        ref = archivos.ligar(db, ids=[datos.archivo_id], tipo="comprobante", cuenta=pedido["cuenta_cliente"],
                             contexto={"pedido_id": pedido_id})[0]
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    indice = next(i for i, h in enumerate(pedido["hitos"]) if h["clave"] == clave)
    actualizado = _guardar(db, pedido_id, {f"hitos.{indice}.estado": {"$in": ["pendiente", "rechazado"]}}, {
        "$set": {f"hitos.{indice}.estado": "enviado", f"hitos.{indice}.motivo_rechazo": None},
        "$push": {f"hitos.{indice}.comprobantes": {"archivo": ref, "nota": datos.nota.strip(), "subido_en": ahora(),
                                                   "subido_por": usuario["user_id"]}},
    })
    chat.sistema(db, pedido["hilo"], f"El cliente subió el comprobante de «{hito['nombre']}».")
    _avisar_otro_lado(db, sql, pedido, "maquiladora", tipo="maquila_comprobante", titulo="Te enviaron un comprobante de pago",
                      mensaje=f"{pedido['producto']}: revisa el comprobante de «{hito['nombre']}» y confírmalo.", correo=True)
    return a_pedido(db, actualizado, usuario)


def revisar_comprobante(db: Database, sql: Session, usuario: dict, pedido_id: str, clave: str, *, confirmado: bool,
                        motivo: Optional[str] = None) -> Dict:
    _solo("maquiladora", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    hito = _hito(pedido, clave)
    if not hito or hito["estado"] != "enviado":
        raise error(status.HTTP_409_CONFLICT, "No hay un comprobante por revisar en ese pago")
    indice = next(i for i, h in enumerate(pedido["hitos"]) if h["clave"] == clave)
    cambios = ({f"hitos.{indice}.estado": "confirmado", f"hitos.{indice}.confirmado_en": ahora(),
                f"hitos.{indice}.confirmado_por": usuario["user_id"]} if confirmado
               else {f"hitos.{indice}.estado": "rechazado", f"hitos.{indice}.motivo_rechazo": (motivo or "").strip()})
    actualizado = _guardar(db, pedido_id, {f"hitos.{indice}.estado": "enviado"}, {"$set": cambios})
    if confirmado:
        chat.sistema(db, pedido["hilo"], f"La maquila confirmó el pago «{hito['nombre']}».")
        _avisar_otro_lado(db, sql, pedido, "cliente", tipo="maquila_pago_confirmado", titulo="Confirmaron tu pago",
                          mensaje=f"{pedido['producto']}: «{hito['nombre']}» quedó confirmado.")
    else:
        chat.sistema(db, pedido["hilo"], f"La maquila rechazó el comprobante de «{hito['nombre']}»: {(motivo or '').strip()}")
        _avisar_otro_lado(db, sql, pedido, "cliente", tipo="maquila_pago_rechazado", titulo="Rechazaron tu comprobante",
                          mensaje=f"{pedido['producto']}: {(motivo or '').strip()}", correo=True)
    return a_pedido(db, actualizado, usuario)


def marcar_recibido(db: Database, sql: Session, usuario: dict, pedido_id: str) -> Dict:
    _solo("cliente", usuario)
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    actualizado = _guardar(db, pedido_id, {"estado": "despachado"}, {"$set": {"estado": "entregado", "entregado_en": ahora()}})
    resenas.recalcular_metricas(db, pedido["maquiladora_id"])
    chat.sistema(db, pedido["hilo"], "El cliente confirmó que recibió el pedido.")
    _avisar_otro_lado(db, sql, pedido, "maquiladora", tipo="maquila_entregado", titulo="Entregaste un pedido",
                      mensaje=f"El cliente confirmó que recibió {pedido['producto']} ({pedido['codigo']}).")
    return a_pedido(db, actualizado, usuario)


def cancelar(db: Database, sql: Session, usuario: dict, pedido_id: str, motivo: str) -> Dict:
    pedido = _pedido(db, usuario, pedido_id, incluir_equipo=False)
    lado = "maquiladora" if es_maquiladora(usuario) else "cliente"
    actualizado = _guardar(db, pedido_id, {"estado": "muestra"}, {"$set": {
        "estado": "cancelado", "cancelacion": {"por": lado, "usuario_id": usuario["user_id"], "motivo": motivo.strip(), "en": ahora()}}})
    chat.sistema(db, pedido["hilo"], f"El pedido fue cancelado por {'la maquila' if lado == 'maquiladora' else 'el cliente'}: {motivo.strip()}")
    _avisar_otro_lado(db, sql, pedido, "cliente" if lado == "maquiladora" else "maquiladora", tipo="maquila_pedido_cancelado",
                      titulo="Se canceló un pedido", mensaje=f"{pedido['producto']} ({pedido['codigo']}): {motivo.strip()}", correo=True)
    return a_pedido(db, actualizado, usuario)
