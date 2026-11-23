"""Vitrina pública de la landing: cifras reales y lo más destacado, sin sesión.

Solo sale lo que ya es público dentro del módulo (nombre comercial, ciudad,
categorías, calificación, galería y catálogo de maquilas verificadas): nada de
NIT, contacto ni documentos.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pymongo.database import Database

from maquilas import archivos, parametros
from maquilas.marca_blanca import _filtro_visibles

MAQUILAS_MAX = 6
PRODUCTOS_MAX = 4


def _primera_imagen(referencias: Optional[List[Dict]]) -> Optional[str]:
    for ref in referencias or []:
        if str(ref.get("content_type") or "").startswith("image/"):
            return archivos.con_url(ref)["url"]
    return None


def _maquila(doc: Dict, nombres_cat: Dict[str, str]) -> Dict[str, Any]:
    metricas = doc.get("metricas") or {}
    return {
        "id": doc["_id"],
        "nombre_comercial": doc.get("nombre_comercial"),
        "ciudad": doc.get("ciudad"),
        "categorias": [nombres_cat.get(c, c) for c in doc.get("categorias") or []],
        "pedido_minimo": doc.get("pedido_minimo"),
        "foto": _primera_imagen(doc.get("galeria")),
        "calificacion": metricas.get("calificacion"),
        "resenas": metricas.get("resenas") or 0,
    }


def _producto(doc: Dict, nombres_cat: Dict[str, str], maquilas: Dict[str, Dict]) -> Dict[str, Any]:
    tramos = doc.get("tramos") or []
    maquila = maquilas.get(doc["maquiladora_id"]) or {}
    return {
        "id": doc["_id"],
        "nombre": doc["nombre"],
        "categoria": nombres_cat.get(doc["categoria"], doc["categoria"]),
        "foto": _primera_imagen(doc.get("fotos")),
        "precio_desde": min((t["precio_unitario"] for t in tramos), default=None),
        "pedido_minimo": doc.get("pedido_minimo"),
        "maquila": maquila.get("nombre_comercial"),
        "ciudad": maquila.get("ciudad"),
    }


def publica(db: Database) -> Dict[str, Any]:
    p = parametros.leer(db)
    nombres_cat = {c["clave"]: c["nombre"] for c in p["categorias"]}

    verificadas = list(db.maquiladoras.find({"estado": "verificada"}, {
        "nombre_comercial": 1, "ciudad": 1, "categorias": 1, "pedido_minimo": 1, "galeria": 1, "metricas": 1,
        "verificada_en": 1}))
    por_categoria: Dict[str, int] = {}
    for m in verificadas:
        for c in m.get("categorias") or []:
            por_categoria[c] = por_categoria.get(c, 0) + 1

    calificadas = [m["metricas"] for m in verificadas if (m.get("metricas") or {}).get("calificacion")]
    total_resenas = sum(int(m.get("resenas") or 0) for m in calificadas)
    promedio = (round(sum(m["calificacion"] * int(m.get("resenas") or 0) for m in calificadas) / total_resenas, 1)
                if total_resenas else None)

    # Primero las que tienen foto y mejor calificación; después las más recientes.
    destacadas = sorted(verificadas, key=lambda m: (
        _primera_imagen(m.get("galeria")) is None,
        -((m.get("metricas") or {}).get("calificacion") or 0),
        -(m.get("verificada_en").timestamp() if m.get("verificada_en") else 0),
    ))[:MAQUILAS_MAX]

    filtro = _filtro_visibles(db)
    productos = list(db.productos_mb.find(filtro).sort([("pedidos", -1), ("actualizado_en", -1)]).limit(PRODUCTOS_MAX))
    por_id = {m["_id"]: m for m in verificadas}

    return {
        "cifras": {
            "maquilas": len(verificadas),
            "ciudades": len({(m.get("ciudad") or "").strip().lower() for m in verificadas if m.get("ciudad")}),
            "productos": db.productos_mb.count_documents(filtro),
            "pedidos_entregados": sum(int((m.get("metricas") or {}).get("pedidos_entregados") or 0) for m in verificadas),
            "calificacion": promedio,
            "resenas": total_resenas,
        },
        "categorias": [{"clave": c["clave"], "nombre": c["nombre"], "maquilas": por_categoria.get(c["clave"], 0)}
                       for c in p["categorias"]],
        "etapas": [e["nombre"] for e in p["etapas"]],
        "ruta_legal": [r["nombre"] for r in p["ruta_legal"] if not r.get("categorias")],
        "maquilas": [_maquila(m, nombres_cat) for m in destacadas],
        "productos": [_producto(d, nombres_cat, por_id) for d in productos],
    }
