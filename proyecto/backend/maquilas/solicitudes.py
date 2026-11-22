"""Solicitudes de fabricación y propuestas.

Ciclo de una solicitud:
- `abierta`: el cliente la publicó. Dirigida, le llega a una maquiladora; abierta,
  se reparte entre las más compatibles (`directorio.candidatas_para`).
- `con_propuestas`: al menos una maquiladora envió propuesta.
- `aceptada`: el cliente eligió una propuesta; se crea el pedido.
- `cancelada`: el cliente la retiró antes de elegir.

Cada maquiladora destino tiene su propio estado (`pendiente`, `propuesta`,
`rechazada`) y, si la solicitud es confidencial, la fecha en que aceptó el
acuerdo: antes de aceptarlo solo ve el resumen.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import status
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from sqlalchemy.orm import Session

from maquilas import acceso, archivos, avisos, chat, directorio, parametros
from maquilas.comun import ahora, codigo, error, iso, nuevo_id
from maquilas.esquemas import AceptarPropuestaEntrada, PropuestaEntrada, SolicitudEntrada
from maquilas.identidad import es_equipo, es_maquiladora, maquiladora_id_de, requerir_maquiladora_id

ETIQUETAS = {
    "abierta": "Esperando propuestas",
    "con_propuestas": "Con propuestas",
    "aceptada": "Propuesta aceptada",
    "cancelada": "Cancelada",
}
ESTADOS_VIVOS = ("abierta", "con_propuestas")


# ── Serialización ────────────────────────────────────────────────────────────

def precio_para(tramos: List[Dict], cantidad: int) -> Optional[int]:
    """Precio por unidad del tramo que aplica a esa cantidad (el de mayor mínimo que la cubre)."""
    aplicables = [t for t in sorted(tramos, key=lambda t: t["cantidad_min"]) if t["cantidad_min"] <= cantidad]
    return aplicables[-1]["precio_unitario"] if aplicables else None


def montos_hitos(hitos: Dict[str, int], total: int, db: Database) -> List[Dict]:
    """Reparte el total por hitos; el último absorbe el redondeo para que sumen exacto."""
    nombres = {h["clave"]: h["nombre"] for h in parametros.leer(db)["hitos"]}
    orden = [h["clave"] for h in parametros.leer(db)["hitos"] if h["clave"] in hitos]
    salida, acumulado = [], 0
    for i, clave in enumerate(orden):
        monto = total - acumulado if i == len(orden) - 1 else round(total * hitos[clave] / 100)
        acumulado += monto
        salida.append({"clave": clave, "nombre": nombres.get(clave, clave), "porcentaje": hitos[clave], "monto": monto})
    return salida


def a_propuesta(db: Database, prop: Dict, cantidad: int) -> Dict:
    precio = precio_para(prop["tramos"], cantidad) or 0
    total = precio * cantidad + int(prop.get("costo_muestra") or 0)
    maquiladora = db.maquiladoras.find_one({"_id": prop["maquiladora_id"]}, {"nombre_comercial": 1, "ciudad": 1, "estado": 1}) or {}
    return {
        "id": prop["_id"],
        "maquiladora": {"id": prop["maquiladora_id"], "nombre_comercial": maquiladora.get("nombre_comercial"),
                        "ciudad": maquiladora.get("ciudad"), "verificada": maquiladora.get("estado") == "verificada"},
        "tramos": prop["tramos"],
        "precio_unitario": precio,
        "costo_muestra": prop.get("costo_muestra") or 0,
        "total": total,
        "dias_muestra": prop["dias_muestra"],
        "dias_produccion": prop["dias_produccion"],
        "hitos": montos_hitos(prop["hitos"], total, db),
        "condiciones": prop.get("condiciones") or "",
        "valida_hasta": iso(prop.get("valida_hasta")),
        "vencida": bool(prop.get("valida_hasta")) and prop["valida_hasta"] < ahora() and prop["estado"] == "enviada",
        "estado": prop["estado"],
        "motivo_eleccion": prop.get("motivo_eleccion"),
        "creado_en": iso(prop.get("creado_en")),
        "actualizado_en": iso(prop.get("actualizado_en")),
        "hilo": chat.hilo_de(prop["solicitud_id"], prop["maquiladora_id"]),
    }


def a_solicitud(db: Database, doc: Dict, usuario: dict) -> Dict:
    p = parametros.leer(db)
    nombres_cat = {c["clave"]: c["nombre"] for c in p["categorias"]}
    salida: Dict[str, Any] = {
        "id": doc["_id"],
        "codigo": doc["codigo"],
        "modalidad": doc["modalidad"],
        "estado": doc["estado"],
        "estado_etiqueta": ETIQUETAS.get(doc["estado"], doc["estado"]),
        "categoria": doc["categoria"],
        "categoria_nombre": nombres_cat.get(doc["categoria"], doc["categoria"]),
        "titulo": doc["titulo"],
        "cantidad": doc["cantidad"],
        "ciudad_entrega": doc["ciudad_entrega"],
        "fecha_objetivo": doc.get("fecha_objetivo").date().isoformat() if doc.get("fecha_objetivo") else None,
        "presupuesto_unitario": doc.get("presupuesto_unitario"),
        "confidencial": bool(doc.get("confidencial")),
        "cliente": doc.get("cliente") or {},
        "creado_en": iso(doc.get("creado_en")),
        "pedido_id": doc.get("pedido_id"),
    }
    ve_detalle = acceso.puede_ver_detalle_solicitud(db, doc, usuario)
    if ve_detalle:
        etiquetas = {c["clave"]: c["etiqueta"] for c in parametros.plantilla(db, doc["categoria"])}
        salida.update({
            "descripcion": doc.get("descripcion") or "",
            "campos": [{"clave": k, "etiqueta": etiquetas.get(k, k), "valor": v} for k, v in (doc.get("campos") or {}).items()],
            "referencias": [archivos.con_url(r) for r in doc.get("referencias") or []],
            "ficha_tecnica": archivos.con_url(doc.get("ficha_tecnica")),
        })
    salida["detalle_visible"] = ve_detalle

    if acceso.es_cliente_de(doc, usuario) or es_equipo(usuario):
        props = list(db.propuestas.find({"solicitud_id": doc["_id"]}).sort("creado_en", 1))
        nombres = {m["_id"]: m.get("nombre_comercial") for m in db.maquiladoras.find(
            {"_id": {"$in": [d["maquiladora_id"] for d in doc.get("destinos") or []]}}, {"nombre_comercial": 1})}
        salida["destinos"] = [{
            "maquiladora_id": d["maquiladora_id"], "nombre_comercial": nombres.get(d["maquiladora_id"]),
            "estado": d.get("estado"), "motivo": d.get("motivo"),
            "hilo": chat.hilo_de(doc["_id"], d["maquiladora_id"]),
        } for d in doc.get("destinos") or []]
        salida["propuestas"] = [a_propuesta(db, prop, doc["cantidad"]) for prop in props]
    elif es_maquiladora(usuario):
        maquiladora_id = maquiladora_id_de(db, usuario)
        destino = acceso.destino_de(doc, maquiladora_id) or {}
        mia = db.propuestas.find_one({"solicitud_id": doc["_id"], "maquiladora_id": maquiladora_id})
        salida["mi_destino"] = {"estado": destino.get("estado"), "motivo": destino.get("motivo"),
                                "acuerdo_pendiente": bool(doc.get("confidencial")) and not destino.get("nda_aceptado_en"),
                                "nda_aceptado_en": iso(destino.get("nda_aceptado_en"))}
        salida["mi_propuesta"] = a_propuesta(db, mia, doc["cantidad"]) if mia else None
        salida["hilo"] = chat.hilo_de(doc["_id"], maquiladora_id)
        if doc.get("pedido_id") and mia and mia["estado"] != "aceptada":
            salida["pedido_id"] = None  # el pedido es de otra maquiladora
    return salida


# ── Cliente ──────────────────────────────────────────────────────────────────

def _cliente_snapshot(sql: Session, usuario: dict) -> Dict:
    from models.importador import Importador
    from models.usuario import Usuario

    fila = sql.query(Usuario).filter(Usuario.id == usuario["user_id"]).first()
    nombre = " ".join(x for x in ((fila.nombre if fila else None), (fila.apellido if fila else None)) if x) or (fila.email if fila else "")
    empresa = None
    if usuario.get("importador_id"):
        imp = sql.query(Importador.nombre_empresa).filter(Importador.id == usuario["importador_id"]).first()
        empresa = imp[0] if imp else None
    elif fila is not None and fila.razon_social:
        empresa = fila.razon_social
    return {"nombre": nombre, "empresa": empresa}


def crear(db: Database, sql: Session, usuario: dict, datos: SolicitudEntrada) -> Dict:
    cuenta = acceso.cuenta_cliente(usuario)
    if not cuenta:
        raise error(status.HTTP_403_FORBIDDEN, "Solo los clientes publican solicitudes de fabricación")
    if datos.categoria not in {c["clave"] for c in parametros.leer(db)["categorias"]}:
        raise error(status.HTTP_400_BAD_REQUEST, "Esa categoría no existe")
    if datos.fecha_objetivo and datos.fecha_objetivo <= ahora().date():
        raise error(status.HTTP_400_BAD_REQUEST, "La fecha objetivo tiene que ser futura")

    if datos.modalidad == "dirigida":
        if not datos.maquiladora_id:
            raise error(status.HTTP_400_BAD_REQUEST, "Elige a qué maquila le envías la solicitud")
        elegida = db.maquiladoras.find_one({"_id": datos.maquiladora_id, "estado": "verificada"})
        if not elegida:
            raise error(status.HTTP_404_NOT_FOUND, "Esa maquila no está disponible")
        if elegida.get("pedido_minimo") and datos.cantidad < elegida["pedido_minimo"]:
            raise error(status.HTTP_400_BAD_REQUEST,
                        f"{elegida['nombre_comercial']} fabrica desde {elegida['pedido_minimo']:,} unidades".replace(",", "."))
        candidatas = [elegida]
    else:
        candidatas = directorio.candidatas_para(db, categoria=datos.categoria, cantidad=datos.cantidad,
                                                ciudad=datos.ciudad_entrega)
        if not candidatas:
            raise error(status.HTTP_409_CONFLICT,
                        "Todavía no hay maquilas verificadas para esa categoría y cantidad. Prueba con otra cantidad o vuelve pronto.")

    solicitud_id = nuevo_id()
    contexto = {"solicitud_id": solicitud_id}
    try:
        referencias = archivos.ligar(db, ids=datos.referencias, tipo="referencia", cuenta=cuenta, contexto=contexto)
        ficha = (archivos.ligar(db, ids=[datos.ficha_tecnica], tipo="ficha_tecnica", cuenta=cuenta, contexto=contexto)[0]
                 if datos.ficha_tecnica else None)
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))

    momento = ahora()
    doc = {
        "_id": solicitud_id,
        "codigo": codigo("MQ", solicitud_id),
        "cuenta_cliente": cuenta,
        "creado_por": usuario["user_id"],
        "cliente": _cliente_snapshot(sql, usuario),
        "modalidad": datos.modalidad,
        "estado": "abierta",
        "categoria": datos.categoria,
        "titulo": datos.titulo.strip(),
        "descripcion": datos.descripcion.strip(),
        "cantidad": datos.cantidad,
        "presupuesto_unitario": datos.presupuesto_unitario,
        "fecha_objetivo": datetime.combine(datos.fecha_objetivo, time()) if datos.fecha_objetivo else None,
        "ciudad_entrega": datos.ciudad_entrega.strip(),
        "campos": datos.campos,
        "referencias": referencias,
        "ficha_tecnica": ficha,
        "confidencial": datos.confidencial,
        "destinos": [{"maquiladora_id": m["_id"], "estado": "pendiente", "asignada_en": momento, "nda_aceptado_en": None}
                     for m in candidatas],
        "creado_en": momento,
        "actualizado_en": momento,
    }
    db.solicitudes.insert_one(doc)
    for m in candidatas:
        avisos.avisar(sql, avisos.usuarios_de_maquiladora(db, m["_id"]), tipo="maquila_solicitud",
                      titulo="Nueva solicitud de fabricación",
                      mensaje=f"{doc['titulo']} · {doc['cantidad']:,} unidades".replace(",", "."),
                      data={"evento": "maquila_solicitud", "solicitud_id": solicitud_id}, correo=True)
    return a_solicitud(db, doc, usuario)


def mis_solicitudes(db: Database, usuario: dict) -> List[Dict]:
    cuenta = acceso.cuenta_cliente(usuario)
    if not cuenta:
        raise error(status.HTTP_403_FORBIDDEN, "Solo los clientes tienen solicitudes")
    filas = db.solicitudes.find({"cuenta_cliente": cuenta}).sort("creado_en", -1).limit(200)
    salida = []
    for doc in filas:
        item = a_solicitud(db, doc, usuario)
        salida.append({k: item[k] for k in ("id", "codigo", "modalidad", "estado", "estado_etiqueta", "categoria_nombre",
                                            "titulo", "cantidad", "creado_en", "pedido_id")}
                      | {"propuestas": len(item.get("propuestas") or []), "destinos": len(item.get("destinos") or [])})
    return salida


def _solicitud(db: Database, solicitud_id: str) -> Dict:
    doc = db.solicitudes.find_one({"_id": solicitud_id})
    if not doc:
        raise error(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    return doc


def detalle(db: Database, usuario: dict, solicitud_id: str) -> Dict:
    doc = _solicitud(db, solicitud_id)
    if not acceso.puede_ver_resumen_solicitud(db, doc, usuario):
        raise error(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    return a_solicitud(db, doc, usuario)


def cancelar(db: Database, sql: Session, usuario: dict, solicitud_id: str) -> Dict:
    doc = _solicitud(db, solicitud_id)
    if not acceso.es_cliente_de(doc, usuario):
        raise error(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    actualizado = db.solicitudes.find_one_and_update(
        {"_id": solicitud_id, "estado": {"$in": list(ESTADOS_VIVOS)}},
        {"$set": {"estado": "cancelada", "actualizado_en": ahora()}}, return_document=ReturnDocument.AFTER)
    if not actualizado:
        raise error(status.HTTP_409_CONFLICT, "Esta solicitud ya no se puede cancelar")
    db.propuestas.update_many({"solicitud_id": solicitud_id, "estado": "enviada"}, {"$set": {"estado": "descartada"}})
    for d in doc.get("destinos") or []:
        avisos.avisar(sql, avisos.usuarios_de_maquiladora(db, d["maquiladora_id"]), tipo="maquila_solicitud_cancelada",
                      titulo="Una solicitud fue cancelada", mensaje=f"El cliente canceló «{doc['titulo']}».",
                      data={"evento": "maquila_solicitud_cancelada", "solicitud_id": solicitud_id})
    return a_solicitud(db, actualizado, usuario)


# ── Maquiladora ──────────────────────────────────────────────────────────────

def _requerir_destino(db: Database, usuario: dict, solicitud_id: str) -> tuple:
    maquiladora_id = requerir_maquiladora_id(db, usuario)
    doc = _solicitud(db, solicitud_id)
    destino = acceso.destino_de(doc, maquiladora_id)
    if not destino:
        raise error(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    maquiladora = db.maquiladoras.find_one({"_id": maquiladora_id}, {"estado": 1, "nombre_comercial": 1})
    if not maquiladora or maquiladora.get("estado") != "verificada":
        raise error(status.HTTP_403_FORBIDDEN, "Tu maquila tiene que estar verificada para atender solicitudes")
    return doc, destino, maquiladora_id, maquiladora


def recibidas(db: Database, usuario: dict) -> List[Dict]:
    maquiladora_id = requerir_maquiladora_id(db, usuario)
    filas = db.solicitudes.find({"destinos.maquiladora_id": maquiladora_id}).sort("creado_en", -1).limit(200)
    salida = []
    for doc in filas:
        item = a_solicitud(db, doc, usuario)
        salida.append({k: item.get(k) for k in ("id", "codigo", "modalidad", "estado", "estado_etiqueta", "categoria_nombre",
                                                "titulo", "cantidad", "ciudad_entrega", "fecha_objetivo", "confidencial",
                                                "creado_en", "mi_destino", "pedido_id")}
                      | {"mi_propuesta_estado": (item.get("mi_propuesta") or {}).get("estado")})
    return salida


def aceptar_acuerdo(db: Database, usuario: dict, solicitud_id: str) -> Dict:
    doc, destino, maquiladora_id, _ = _requerir_destino(db, usuario, solicitud_id)
    if not doc.get("confidencial"):
        return a_solicitud(db, doc, usuario)
    if not destino.get("nda_aceptado_en"):
        db.solicitudes.update_one(
            {"_id": solicitud_id, "destinos.maquiladora_id": maquiladora_id},
            {"$set": {"destinos.$.nda_aceptado_en": ahora(), "destinos.$.nda_aceptado_por": usuario["user_id"]}})
    return a_solicitud(db, _solicitud(db, solicitud_id), usuario)


def rechazar(db: Database, sql: Session, usuario: dict, solicitud_id: str, motivo: str) -> Dict:
    doc, destino, maquiladora_id, maquiladora = _requerir_destino(db, usuario, solicitud_id)
    if doc["estado"] not in ESTADOS_VIVOS or destino.get("estado") != "pendiente":
        raise error(status.HTTP_409_CONFLICT, "Ya respondiste esta solicitud")
    db.solicitudes.update_one({"_id": solicitud_id, "destinos.maquiladora_id": maquiladora_id},
                              {"$set": {"destinos.$.estado": "rechazada", "destinos.$.motivo": motivo.strip()}})
    avisos.avisar(sql, avisos.usuarios_de_cliente(sql, doc["cuenta_cliente"]), tipo="maquila_solicitud_rechazada",
                  titulo="Una maquila no tomará tu solicitud",
                  mensaje=f"{maquiladora['nombre_comercial']} no puede fabricar «{doc['titulo']}»: {motivo.strip()}",
                  data={"evento": "maquila_solicitud_rechazada", "solicitud_id": solicitud_id})
    return a_solicitud(db, _solicitud(db, solicitud_id), usuario)


def guardar_propuesta(db: Database, sql: Session, usuario: dict, solicitud_id: str, datos: PropuestaEntrada) -> Dict:
    doc, destino, maquiladora_id, maquiladora = _requerir_destino(db, usuario, solicitud_id)
    if doc["estado"] not in ESTADOS_VIVOS:
        raise error(status.HTTP_409_CONFLICT, "Esta solicitud ya no recibe propuestas")
    if destino.get("estado") == "rechazada":
        raise error(status.HTTP_409_CONFLICT, "Ya rechazaste esta solicitud")
    if not acceso.acuerdo_ok(doc, destino):
        raise error(status.HTTP_403_FORBIDDEN, "Acepta el acuerdo de confidencialidad antes de proponer")
    claves_hitos = {h["clave"] for h in parametros.leer(db)["hitos"]}
    if set(datos.hitos) - claves_hitos:
        raise error(status.HTTP_400_BAD_REQUEST, "Hay un hito de pago que no existe")
    tramos = sorted({t.cantidad_min: t.precio_unitario for t in datos.tramos}.items())
    if precio_para([{"cantidad_min": c, "precio_unitario": p} for c, p in tramos], doc["cantidad"]) is None:
        raise error(status.HTTP_400_BAD_REQUEST,
                    f"Tu primer tramo tiene que empezar en {doc['cantidad']:,} unidades o menos (lo que pide el cliente)".replace(",", "."))

    momento = ahora()
    campos = {
        "tramos": [{"cantidad_min": c, "precio_unitario": p} for c, p in tramos],
        "costo_muestra": datos.costo_muestra,
        "dias_muestra": datos.dias_muestra,
        "dias_produccion": datos.dias_produccion,
        "hitos": datos.hitos,
        "condiciones": datos.condiciones.strip(),
        "valida_hasta": momento + timedelta(days=datos.validez_dias),
        "actualizado_en": momento,
    }
    existente = db.propuestas.find_one({"solicitud_id": solicitud_id, "maquiladora_id": maquiladora_id})
    if existente and existente["estado"] != "enviada":
        raise error(status.HTTP_409_CONFLICT, "Esta propuesta ya no se puede editar")
    if existente:
        db.propuestas.update_one({"_id": existente["_id"]}, {"$set": campos})
        propuesta_id, nueva = existente["_id"], False
    else:
        propuesta_id, nueva = nuevo_id(), True
        try:
            db.propuestas.insert_one({"_id": propuesta_id, "solicitud_id": solicitud_id, "maquiladora_id": maquiladora_id,
                                      "cuenta_cliente": doc["cuenta_cliente"], "estado": "enviada",
                                      "creado_por": usuario["user_id"], "creado_en": momento, **campos})
        except DuplicateKeyError:
            raise error(status.HTTP_409_CONFLICT, "Ya enviaste una propuesta; edítala en vez de crear otra")
    db.solicitudes.update_one({"_id": solicitud_id, "destinos.maquiladora_id": maquiladora_id},
                              {"$set": {"destinos.$.estado": "propuesta", "actualizado_en": momento}})
    db.solicitudes.update_one({"_id": solicitud_id, "estado": "abierta"}, {"$set": {"estado": "con_propuestas"}})

    hilo = chat.hilo_de(solicitud_id, maquiladora_id)
    chat.sistema(db, hilo, f"{maquiladora['nombre_comercial']} {'envió' if nueva else 'actualizó'} su propuesta.")
    avisos.avisar(sql, avisos.usuarios_de_cliente(sql, doc["cuenta_cliente"]), tipo="maquila_propuesta",
                  titulo="Recibiste una propuesta" if nueva else "Una propuesta cambió",
                  mensaje=f"{maquiladora['nombre_comercial']} propone fabricar «{doc['titulo']}».",
                  data={"evento": "maquila_propuesta", "solicitud_id": solicitud_id}, correo=nueva)
    return a_solicitud(db, _solicitud(db, solicitud_id), usuario)


# ── El cliente elige ─────────────────────────────────────────────────────────

def aceptar_propuesta(db: Database, sql: Session, usuario: dict, propuesta_id: str, datos: AceptarPropuestaEntrada) -> Dict:
    from maquilas import pedidos

    prop = db.propuestas.find_one({"_id": propuesta_id})
    if not prop:
        raise error(status.HTTP_404_NOT_FOUND, "Propuesta no encontrada")
    doc = _solicitud(db, prop["solicitud_id"])
    if not acceso.es_cliente_de(doc, usuario):
        raise error(status.HTTP_404_NOT_FOUND, "Propuesta no encontrada")
    if prop["estado"] != "enviada":
        raise error(status.HTTP_409_CONFLICT, "Esta propuesta ya no se puede aceptar")
    if prop.get("valida_hasta") and prop["valida_hasta"] < ahora():
        raise error(status.HTTP_409_CONFLICT, "Esta propuesta venció. Pídele a la maquila que la actualice.")
    # La solicitud se cierra con una actualización condicional: dos clics a la vez no crean dos pedidos.
    cerrada = db.solicitudes.find_one_and_update(
        {"_id": doc["_id"], "estado": {"$in": list(ESTADOS_VIVOS)}},
        {"$set": {"estado": "aceptada", "propuesta_aceptada_id": propuesta_id, "actualizado_en": ahora()}},
        return_document=ReturnDocument.AFTER)
    if not cerrada:
        raise error(status.HTTP_409_CONFLICT, "Esta solicitud ya tiene una propuesta aceptada")
    try:
        pedido = pedidos.crear(db, sql, cerrada, prop, usuario)
    except Exception:
        db.solicitudes.update_one({"_id": doc["_id"]}, {"$set": {"estado": doc["estado"], "propuesta_aceptada_id": None}})
        raise
    db.propuestas.update_one({"_id": propuesta_id}, {"$set": {"estado": "aceptada", "motivo_eleccion": (datos.motivo or "").strip() or None}})
    descartadas = list(db.propuestas.find({"solicitud_id": doc["_id"], "_id": {"$ne": propuesta_id}, "estado": "enviada"}))
    db.propuestas.update_many({"_id": {"$in": [d["_id"] for d in descartadas]}}, {"$set": {"estado": "descartada"}})
    db.solicitudes.update_one({"_id": doc["_id"]}, {"$set": {"pedido_id": pedido["_id"]}})

    chat.sistema(db, chat.hilo_de(doc["_id"], prop["maquiladora_id"]),
                 f"El cliente aceptó la propuesta. Se abrió el pedido {pedido['codigo']}.")
    avisos.avisar(sql, avisos.usuarios_de_maquiladora(db, prop["maquiladora_id"]), tipo="maquila_propuesta_aceptada",
                  titulo="¡Aceptaron tu propuesta!", mensaje=f"Se abrió el pedido {pedido['codigo']} de «{doc['titulo']}».",
                  data={"evento": "maquila_propuesta_aceptada", "pedido_id": pedido["_id"]}, correo=True)
    for d in descartadas:
        avisos.avisar(sql, avisos.usuarios_de_maquiladora(db, d["maquiladora_id"]), tipo="maquila_propuesta_descartada",
                      titulo="El cliente eligió otra propuesta", mensaje=f"«{doc['titulo']}» se fabricará con otra maquila.",
                      data={"evento": "maquila_propuesta_descartada", "solicitud_id": doc["_id"]})
    return pedidos.a_pedido(db, pedido, usuario)
