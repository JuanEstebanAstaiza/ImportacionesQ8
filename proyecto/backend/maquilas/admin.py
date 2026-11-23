"""Lo que ve el equipo de Zarpi del módulo: resumen y monitoreo de solicitudes y pedidos.

Solo lectura: el equipo no actúa por las partes. Para intervenir en un pedido se
usa la mesa de ayuda (los tickets llevan `referencia=pedido:<id>`).
"""
from __future__ import annotations

import re
from datetime import timedelta
from typing import Any, Dict, List, Optional

from pymongo.database import Database

from maquilas import pedidos, solicitudes
from maquilas.comun import ahora, iso


def _conteo(db: Database, coleccion: str, campo: str = "estado", filtro: Optional[Dict] = None) -> Dict[str, int]:
    return {f["_id"]: f["n"] for f in db[coleccion].aggregate([
        {"$match": filtro or {}}, {"$group": {"_id": f"${campo}", "n": {"$sum": 1}}}]) if f["_id"] is not None}


def resumen(db: Database) -> Dict[str, Any]:
    momento = ahora()
    hace_30 = momento - timedelta(days=30)
    activos = list(db.pedidos.find({"estado": {"$in": list(pedidos.ESTADOS_ACTIVOS)}},
                                   {"total": 1, "fecha_compromiso": 1, "hitos": 1}))
    valor_entregado = next(db.pedidos.aggregate([
        {"$match": {"estado": "entregado", "entregado_en": {"$gte": hace_30}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "n": {"$sum": 1}}}]), {"total": 0, "n": 0})
    calif = next(db.resenas.aggregate([{"$match": {"oculta": None}},
                                       {"$group": {"_id": None, "prom": {"$avg": "$calificacion"}, "n": {"$sum": 1}}}]), None)
    pendientes_pago = sum(1 for p in activos for h in p.get("hitos") or [] if h.get("estado") == "enviado")
    mejores = list(db.maquiladoras.find({"estado": "verificada", "metricas.pedidos_entregados": {"$gt": 0}},
                                        {"nombre_comercial": 1, "ciudad": 1, "metricas": 1})
                   .sort([("metricas.pedidos_entregados", -1), ("metricas.calificacion", -1)]).limit(5))
    return {
        "maquiladoras": _conteo(db, "maquiladoras"),
        "solicitudes": _conteo(db, "solicitudes"),
        "solicitudes_30_dias": db.solicitudes.count_documents({"creado_en": {"$gte": hace_30}}),
        "solicitudes_por_modalidad": _conteo(db, "solicitudes", "modalidad"),
        "solicitudes_sin_propuesta": db.solicitudes.count_documents({"estado": "abierta", "creado_en": {"$lte": momento - timedelta(days=3)}}),
        "pedidos": _conteo(db, "pedidos"),
        "pedidos_activos": len(activos),
        "valor_activo": sum(int(p.get("total") or 0) for p in activos),
        "pedidos_retrasados": sum(1 for p in activos if p.get("fecha_compromiso") and p["fecha_compromiso"] < momento),
        "comprobantes_por_revisar": pendientes_pago,
        "entregados_30_dias": {"n": valor_entregado["n"], "valor": valor_entregado["total"]},
        "resenas": {"n": calif["n"] if calif else 0, "promedio": round(calif["prom"], 1) if calif else None},
        "productos_publicados": db.productos_mb.count_documents({"activo": True, "oculto": None}),
        "marcas": db.marcas.count_documents({}),
        "encargos": _conteo(db, "encargos"),
        "mejores_maquilas": [{"id": m["_id"], "nombre_comercial": m.get("nombre_comercial"), "ciudad": m.get("ciudad"),
                              "metricas": m.get("metricas")} for m in mejores],
    }


def _patron(q: Optional[str]) -> Optional[Dict]:
    return {"$regex": re.escape(q.strip()[:80]), "$options": "i"} if q and q.strip() else None


def listar_solicitudes(db: Database, usuario: dict, *, estado: Optional[str] = None, q: Optional[str] = None,
                       modalidad: Optional[str] = None) -> List[Dict]:
    filtro: Dict[str, Any] = {}
    if estado:
        filtro["estado"] = estado
    if modalidad:
        filtro["modalidad"] = modalidad
    patron = _patron(q)
    if patron:
        filtro["$or"] = [{"titulo": patron}, {"codigo": patron}, {"cliente.nombre": patron}, {"cliente.empresa": patron}]
    salida = []
    for doc in db.solicitudes.find(filtro).sort("creado_en", -1).limit(200):
        item = solicitudes.a_solicitud(db, doc, usuario)
        salida.append({k: item.get(k) for k in ("id", "codigo", "modalidad", "estado", "estado_etiqueta", "categoria_nombre", "titulo",
                                                "cantidad", "cliente", "creado_en", "pedido_id")}
                      | {"destinos": len(item.get("destinos") or []), "propuestas": len(item.get("propuestas") or [])})
    return salida


def listar_pedidos(db: Database, usuario: dict, *, estado: Optional[str] = None, q: Optional[str] = None,
                   retrasados: bool = False) -> List[Dict]:
    filtro: Dict[str, Any] = {}
    if estado:
        filtro["estado"] = estado
    if retrasados:
        filtro["estado"] = {"$in": list(pedidos.ESTADOS_ACTIVOS)}
        filtro["fecha_compromiso"] = {"$lt": ahora()}
    patron = _patron(q)
    if patron:
        filtro["$or"] = [{"producto": patron}, {"codigo": patron}, {"cliente.nombre": patron}, {"cliente.empresa": patron},
                         {"maquiladora.nombre_comercial": patron}]
    salida = []
    for doc in db.pedidos.find(filtro).sort("creado_en", -1).limit(200):
        hechas = sum(1 for e in doc["etapas"] if e["estado"] == "hecha")
        activo = doc["estado"] in pedidos.ESTADOS_ACTIVOS
        salida.append({
            "id": doc["_id"], "codigo": doc["codigo"], "estado": doc["estado"],
            "estado_etiqueta": pedidos.ETIQUETAS.get(doc["estado"], doc["estado"]), "producto": doc["producto"],
            "cantidad": doc["cantidad"], "total": doc["total"],
            "pagado": sum(h["monto"] for h in doc["hitos"] if h["estado"] == "confirmado"),
            "cliente": doc.get("cliente") or {}, "maquiladora": {"id": doc["maquiladora_id"], **(doc.get("maquiladora") or {})},
            "fecha_compromiso": iso(doc.get("fecha_compromiso")),
            "retrasado": bool(activo and doc.get("fecha_compromiso") and doc["fecha_compromiso"] < ahora()),
            "etapas_hechas": hechas, "etapas_total": len(doc["etapas"]),
            # Qué le toca a cada lado (el equipo ve las dos caras).
            "aviso_cliente": pedidos.aviso_para(doc, "cliente") if activo else None,
            "aviso_maquila": pedidos.aviso_para(doc, "maquiladora") if activo else None,
            "creado_en": iso(doc.get("creado_en")),
        })
    return salida
