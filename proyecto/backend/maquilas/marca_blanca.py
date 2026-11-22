"""Catálogo de marca blanca: productos listos que el cliente fabrica con su marca.

La maquiladora publica el producto (fotos, pedido mínimo, precio por cantidad, qué
se personaliza y tiempos). Solo se ve en el catálogo si está activo, la maquila
está verificada y el equipo no lo ocultó. El cliente lo pide con una solicitud
`marca_blanca`, que le llega a esa maquila y sigue el flujo de siempre
(propuesta, muestra, producción).
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import status
from pymongo.database import Database
from sqlalchemy.orm import Session

from maquilas import archivos, avisos, parametros
from maquilas.comun import ahora, error, iso, nuevo_id
from maquilas.esquemas import ProductoEntrada
from maquilas.identidad import requerir_maquiladora_id


def _verificadas(db: Database, ids: List[str]) -> Dict[str, Dict]:
    return {m["_id"]: m for m in db.maquiladoras.find({"_id": {"$in": list(set(ids))}},
                                                      {"nombre_comercial": 1, "ciudad": 1, "estado": 1, "metricas": 1})}


def a_producto(db: Database, doc: Dict, *, maquiladora: Optional[Dict] = None, privado: bool = False) -> Dict[str, Any]:
    p = parametros.leer(db)
    nombres_cat = {c["clave"]: c["nombre"] for c in p["categorias"]}
    nombres_pers = {c["clave"]: c["nombre"] for c in p["personalizaciones"]}
    maquiladora = maquiladora or db.maquiladoras.find_one({"_id": doc["maquiladora_id"]},
                                                          {"nombre_comercial": 1, "ciudad": 1, "estado": 1, "metricas": 1}) or {}
    tramos = sorted(doc.get("tramos") or [], key=lambda t: t["cantidad_min"])
    salida = {
        "id": doc["_id"],
        "nombre": doc["nombre"],
        "categoria": doc["categoria"],
        "categoria_nombre": nombres_cat.get(doc["categoria"], doc["categoria"]),
        "descripcion": doc.get("descripcion") or "",
        "fotos": [archivos.con_url(f) for f in doc.get("fotos") or []],
        "tramos": tramos,
        "precio_desde": min((t["precio_unitario"] for t in tramos), default=None),
        "pedido_minimo": doc["pedido_minimo"],
        "personalizable": [{"clave": c, "nombre": nombres_pers.get(c, c)} for c in doc.get("personalizable") or []],
        "costo_muestra": doc.get("costo_muestra") or 0,
        "dias_muestra": doc.get("dias_muestra"),
        "dias_produccion": doc.get("dias_produccion"),
        "pedidos": doc.get("pedidos") or 0,
        "maquiladora": {"id": doc["maquiladora_id"], "nombre_comercial": maquiladora.get("nombre_comercial"),
                        "ciudad": maquiladora.get("ciudad"), "metricas": maquiladora.get("metricas")},
        "actualizado_en": iso(doc.get("actualizado_en")),
    }
    if privado:
        oculto = doc.get("oculto")
        salida.update({
            "activo": bool(doc.get("activo")),
            "oculto": {"motivo": oculto.get("motivo"), "en": iso(oculto.get("en"))} if oculto else None,
            "visible": bool(doc.get("activo")) and not oculto and maquiladora.get("estado") == "verificada",
            "creado_en": iso(doc.get("creado_en")),
        })
    return salida


# ── La maquiladora ───────────────────────────────────────────────────────────

def mis_productos(db: Database, usuario: dict) -> List[Dict]:
    maquiladora_id = requerir_maquiladora_id(db, usuario)
    maquiladora = db.maquiladoras.find_one({"_id": maquiladora_id})
    filas = db.productos_mb.find({"maquiladora_id": maquiladora_id}).sort("creado_en", -1)
    return [a_producto(db, d, maquiladora=maquiladora, privado=True) for d in filas]


def _validar(db: Database, maquiladora: Dict, datos: ProductoEntrada) -> None:
    p = parametros.leer(db)
    if datos.categoria not in (maquiladora.get("categorias") or []):
        raise error(status.HTTP_400_BAD_REQUEST, "Elige una de las categorías que fabricas (las cambias en «Mi maquila»)")
    if set(datos.personalizable) - {c["clave"] for c in p["personalizaciones"]}:
        raise error(status.HTTP_400_BAD_REQUEST, "Hay una opción de personalización que no existe")
    if len(datos.fotos) > int(p["fotos_producto_max"]):
        raise error(status.HTTP_400_BAD_REQUEST, f"Máximo {p['fotos_producto_max']} fotos por producto")
    tramos = sorted(datos.tramos, key=lambda t: t.cantidad_min)
    if tramos[0].cantidad_min > datos.pedido_minimo:
        raise error(status.HTTP_400_BAD_REQUEST, "El primer precio tiene que empezar en el pedido mínimo o antes")
    if datos.activo and maquiladora.get("estado") != "verificada":
        raise error(status.HTTP_409_CONFLICT, "Tu maquila tiene que estar verificada para publicar productos. Guárdalo como borrador.")
    if datos.activo and not datos.fotos:
        raise error(status.HTTP_400_BAD_REQUEST, "Sube al menos una foto para publicar el producto")


def _campos(db: Database, maquiladora_id: str, producto_id: str, datos: ProductoEntrada) -> Dict:
    try:
        fotos = archivos.ligar(db, ids=datos.fotos, tipo="producto", cuenta=f"maquiladora:{maquiladora_id}",
                               contexto={"producto_id": producto_id})
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    tramos = sorted({t.cantidad_min: t.precio_unitario for t in datos.tramos}.items())
    return {
        "nombre": datos.nombre.strip(),
        "categoria": datos.categoria,
        "descripcion": datos.descripcion.strip(),
        "fotos": fotos,
        "tramos": [{"cantidad_min": c, "precio_unitario": p} for c, p in tramos],
        "pedido_minimo": datos.pedido_minimo,
        "personalizable": list(dict.fromkeys(datos.personalizable)),
        "costo_muestra": datos.costo_muestra,
        "dias_muestra": datos.dias_muestra,
        "dias_produccion": datos.dias_produccion,
        "activo": datos.activo,
        "actualizado_en": ahora(),
    }


def crear(db: Database, usuario: dict, datos: ProductoEntrada) -> Dict:
    maquiladora_id = requerir_maquiladora_id(db, usuario)
    maquiladora = db.maquiladoras.find_one({"_id": maquiladora_id})
    _validar(db, maquiladora, datos)
    maximo = int(parametros.leer(db)["productos_max"])
    if db.productos_mb.count_documents({"maquiladora_id": maquiladora_id}) >= maximo:
        raise error(status.HTTP_409_CONFLICT, f"Puedes tener hasta {maximo} productos. Borra o reutiliza uno.")
    producto_id = nuevo_id()
    doc = {"_id": producto_id, "maquiladora_id": maquiladora_id, "oculto": None, "pedidos": 0,
           "creado_por": usuario["user_id"], "creado_en": ahora(), **_campos(db, maquiladora_id, producto_id, datos)}
    db.productos_mb.insert_one(doc)
    return a_producto(db, doc, maquiladora=maquiladora, privado=True)


def actualizar(db: Database, usuario: dict, producto_id: str, datos: ProductoEntrada) -> Dict:
    maquiladora_id = requerir_maquiladora_id(db, usuario)
    doc = db.productos_mb.find_one({"_id": producto_id, "maquiladora_id": maquiladora_id})
    if not doc:
        raise error(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    maquiladora = db.maquiladoras.find_one({"_id": maquiladora_id})
    _validar(db, maquiladora, datos)
    # Las fotos que saque no se borran: las solicitudes hechas desde este producto las siguen mostrando.
    db.productos_mb.update_one({"_id": producto_id}, {"$set": _campos(db, maquiladora_id, producto_id, datos)})
    return a_producto(db, db.productos_mb.find_one({"_id": producto_id}), maquiladora=maquiladora, privado=True)


# ── Catálogo (clientes) ──────────────────────────────────────────────────────

def _filtro_visibles(db: Database) -> Dict[str, Any]:
    verificadas = [m["_id"] for m in db.maquiladoras.find({"estado": "verificada"}, {"_id": 1})]
    return {"activo": True, "oculto": None, "maquiladora_id": {"$in": verificadas}}


def catalogo(db: Database, *, categoria: Optional[str] = None, q: Optional[str] = None, cantidad: Optional[int] = None,
             maquiladora_id: Optional[str] = None) -> List[Dict]:
    filtro = _filtro_visibles(db)
    if categoria:
        filtro["categoria"] = categoria
    if cantidad:
        filtro["pedido_minimo"] = {"$lte": cantidad}
    if maquiladora_id:
        filtro["maquiladora_id"] = maquiladora_id if maquiladora_id in filtro["maquiladora_id"]["$in"] else "__ninguna__"
    if q and q.strip():
        patron = {"$regex": re.escape(q.strip()[:80]), "$options": "i"}
        filtro["$or"] = [{"nombre": patron}, {"descripcion": patron}]
    filas = list(db.productos_mb.find(filtro).sort([("pedidos", -1), ("actualizado_en", -1)]).limit(200))
    maquiladoras = _verificadas(db, [f["maquiladora_id"] for f in filas])
    return [a_producto(db, d, maquiladora=maquiladoras.get(d["maquiladora_id"])) for d in filas]


def visible(db: Database, producto_id: str) -> Optional[Dict]:
    return db.productos_mb.find_one({"_id": producto_id, **_filtro_visibles(db)})


def detalle(db: Database, producto_id: str) -> Dict:
    doc = visible(db, producto_id)
    if not doc:
        raise error(status.HTTP_404_NOT_FOUND, "Ese producto ya no está disponible")
    return a_producto(db, doc)


# ── Equipo de Zarpi ──────────────────────────────────────────────────────────

def listar_para_equipo(db: Database, *, q: Optional[str] = None, ocultos: Optional[bool] = None) -> List[Dict]:
    filtro: Dict[str, Any] = {}
    if ocultos is True:
        filtro["oculto"] = {"$ne": None}
    elif ocultos is False:
        filtro["oculto"] = None
    if q and q.strip():
        filtro["nombre"] = {"$regex": re.escape(q.strip()[:80]), "$options": "i"}
    filas = list(db.productos_mb.find(filtro).sort("actualizado_en", -1).limit(300))
    maquiladoras = _verificadas(db, [f["maquiladora_id"] for f in filas])
    return [a_producto(db, d, maquiladora=maquiladoras.get(d["maquiladora_id"]), privado=True) for d in filas]


def ocultar(db: Database, sql: Session, equipo: dict, producto_id: str, motivo: Optional[str]) -> Dict:
    doc = db.productos_mb.find_one({"_id": producto_id})
    if not doc:
        raise error(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    if motivo is None:
        db.productos_mb.update_one({"_id": producto_id}, {"$set": {"oculto": None}})
    else:
        db.productos_mb.update_one({"_id": producto_id}, {"$set": {"oculto": {"motivo": motivo.strip(), "por": equipo["user_id"], "en": ahora()}}})
        avisos.avisar(sql, avisos.usuarios_de_maquiladora(db, doc["maquiladora_id"]), tipo="maquila_producto_oculto",
                      titulo="Ocultamos un producto de tu catálogo", mensaje=f"«{doc['nombre']}»: {motivo.strip()}",
                      data={"evento": "maquila_producto_oculto", "producto_id": producto_id}, correo=True)
    return a_producto(db, db.productos_mb.find_one({"_id": producto_id}), privado=True)
