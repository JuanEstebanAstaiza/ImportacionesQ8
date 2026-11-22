"""Reseñas de los pedidos entregados y las métricas públicas de cada maquila.

- Una reseña por pedido, del cliente, cuando el pedido está entregado: calificación
  general y por puntualidad, calidad y comunicación (1 a 5), con comentario.
- La maquila puede responderla una vez. El equipo de Zarpi la puede ocultar (con
  motivo); oculta no cuenta en las métricas ni se ve en el perfil.
- Métricas (`maquiladoras.metricas`): calificación promedio, número de reseñas,
  pedidos entregados y cumplimiento de fechas. Se recalculan al entregar un pedido
  y cada vez que cambia una reseña, para que el directorio no las calcule al vuelo.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from sqlalchemy.orm import Session

from maquilas import acceso, avisos
from maquilas.comun import ahora, error, iso, nuevo_id
from maquilas.esquemas import ResenaEntrada
from maquilas.identidad import requerir_maquiladora_id

from maquilas.servicio import METRICAS_VACIAS  # noqa: E402

DIMENSIONES = ("puntualidad", "calidad", "comunicacion")


def a_resena(doc: Dict, *, privado: bool = False) -> Dict[str, Any]:
    respuesta = doc.get("respuesta")
    salida = {
        "id": doc["_id"],
        "pedido_id": doc["pedido_id"],
        "producto": doc.get("producto"),
        "autor": doc.get("autor") or "Cliente",
        "calificacion": doc["calificacion"],
        **{d: doc[d] for d in DIMENSIONES},
        "comentario": doc.get("comentario") or "",
        "creado_en": iso(doc.get("creado_en")),
        "respuesta": {"texto": respuesta["texto"], "en": iso(respuesta.get("en"))} if respuesta else None,
    }
    if privado:
        oculta = doc.get("oculta")
        salida["oculta"] = {"motivo": oculta.get("motivo"), "en": iso(oculta.get("en"))} if oculta else None
        salida["maquiladora_id"] = doc["maquiladora_id"]
    return salida


def de_pedido(db: Database, pedido_id: str) -> Optional[Dict]:
    return db.resenas.find_one({"pedido_id": pedido_id})


def recalcular_metricas(db: Database, maquiladora_id: str) -> Dict:
    entregados = db.pedidos.count_documents({"maquiladora_id": maquiladora_id, "estado": "entregado"})
    a_tiempo = db.pedidos.count_documents({"maquiladora_id": maquiladora_id, "estado": "entregado",
                                           "$expr": {"$lte": ["$entregado_en", "$fecha_compromiso"]}})
    grupo = list(db.resenas.aggregate([
        {"$match": {"maquiladora_id": maquiladora_id, "oculta": None}},
        {"$group": {"_id": None, "n": {"$sum": 1}, "calificacion": {"$avg": "$calificacion"},
                    **{d: {"$avg": f"${d}"} for d in DIMENSIONES}}},
    ]))
    g = grupo[0] if grupo else {}
    metricas = {
        "calificacion": round(g["calificacion"], 1) if g.get("calificacion") is not None else None,
        "resenas": g.get("n", 0),
        "pedidos_entregados": entregados,
        "cumplimiento": round(100 * a_tiempo / entregados) if entregados else None,
        **{d: round(g[d], 1) if g.get(d) is not None else None for d in DIMENSIONES},
    }
    db.maquiladoras.update_one({"_id": maquiladora_id}, {"$set": {"metricas": metricas}})
    return metricas


# ── Cliente ──────────────────────────────────────────────────────────────────

def crear(db: Database, sql: Session, usuario: dict, pedido_id: str, datos: ResenaEntrada) -> Dict:
    pedido = db.pedidos.find_one({"_id": pedido_id})
    if not pedido or not acceso.cuenta_cliente(usuario) or acceso.cuenta_cliente(usuario) != pedido["cuenta_cliente"]:
        raise error(status.HTTP_404_NOT_FOUND, "Pedido no encontrado")
    if pedido["estado"] != "entregado":
        raise error(status.HTTP_409_CONFLICT, "Puedes calificar el pedido cuando lo recibas")
    cliente = pedido.get("cliente") or {}
    doc = {
        "_id": nuevo_id(),
        "pedido_id": pedido_id,
        "maquiladora_id": pedido["maquiladora_id"],
        "cuenta_cliente": pedido["cuenta_cliente"],
        "autor_id": usuario["user_id"],
        # Solo el nombre de pila (o la empresa): la reseña es pública dentro del módulo.
        "autor": cliente.get("empresa") or (cliente.get("nombre") or "Cliente").split(" ")[0],
        "producto": pedido["producto"],
        "calificacion": datos.calificacion,
        **{d: getattr(datos, d) for d in DIMENSIONES},
        "comentario": datos.comentario.strip(),
        "respuesta": None,
        "oculta": None,
        "creado_en": ahora(),
    }
    try:
        db.resenas.insert_one(doc)
    except DuplicateKeyError:
        raise error(status.HTTP_409_CONFLICT, "Ya calificaste este pedido")
    recalcular_metricas(db, pedido["maquiladora_id"])
    avisos.avisar(sql, avisos.usuarios_de_maquiladora(db, pedido["maquiladora_id"]), tipo="maquila_resena",
                  titulo=f"Te calificaron con {datos.calificacion} de 5",
                  mensaje=f"{doc['autor']} calificó «{pedido['producto']}».",
                  data={"evento": "maquila_resena", "resena_id": doc["_id"]})
    return a_resena(doc)


# ── Maquiladora ──────────────────────────────────────────────────────────────

def de_mi_maquiladora(db: Database, usuario: dict) -> Dict:
    maquiladora_id = requerir_maquiladora_id(db, usuario)
    filas = db.resenas.find({"maquiladora_id": maquiladora_id}).sort("creado_en", -1).limit(300)
    doc = db.maquiladoras.find_one({"_id": maquiladora_id}, {"metricas": 1}) or {}
    return {"metricas": doc.get("metricas") or METRICAS_VACIAS, "resenas": [a_resena(r, privado=True) for r in filas]}


def responder(db: Database, sql: Session, usuario: dict, resena_id: str, texto: str) -> Dict:
    maquiladora_id = requerir_maquiladora_id(db, usuario)
    actualizada = db.resenas.find_one_and_update(
        {"_id": resena_id, "maquiladora_id": maquiladora_id, "respuesta": None},
        {"$set": {"respuesta": {"texto": texto.strip(), "por": usuario["user_id"], "en": ahora()}}}, return_document=True)
    if not actualizada:
        if db.resenas.count_documents({"_id": resena_id, "maquiladora_id": maquiladora_id}, limit=1):
            raise error(status.HTTP_409_CONFLICT, "Ya respondiste esta reseña")
        raise error(status.HTTP_404_NOT_FOUND, "Reseña no encontrada")
    avisos.avisar(sql, avisos.usuarios_de_cliente(sql, actualizada["cuenta_cliente"]), tipo="maquila_resena_respuesta",
                  titulo="La maquila respondió tu reseña", mensaje=texto.strip()[:160],
                  data={"evento": "maquila_resena_respuesta", "pedido_id": actualizada["pedido_id"], "lado_destino": "cliente"})
    return a_resena(actualizada, privado=True)


# ── Público (dentro del módulo) ──────────────────────────────────────────────

def publicas(db: Database, maquiladora_id: str) -> List[Dict]:
    filas = db.resenas.find({"maquiladora_id": maquiladora_id, "oculta": None}).sort("creado_en", -1).limit(50)
    return [a_resena(r) for r in filas]


# ── Equipo de Zarpi ──────────────────────────────────────────────────────────

def listar_para_equipo(db: Database, *, ocultas: Optional[bool] = None, maximo: Optional[int] = None) -> List[Dict]:
    filtro: Dict[str, Any] = {}
    if ocultas is True:
        filtro["oculta"] = {"$ne": None}
    elif ocultas is False:
        filtro["oculta"] = None
    if maximo:
        filtro["calificacion"] = {"$lte": maximo}
    filas = list(db.resenas.find(filtro).sort("creado_en", -1).limit(300))
    nombres = {m["_id"]: m.get("nombre_comercial") for m in db.maquiladoras.find(
        {"_id": {"$in": list({r["maquiladora_id"] for r in filas})}}, {"nombre_comercial": 1})}
    return [a_resena(r, privado=True) | {"maquiladora": nombres.get(r["maquiladora_id"])} for r in filas]


def moderar(db: Database, equipo: dict, resena_id: str, motivo: Optional[str]) -> Dict:
    """Con motivo la oculta; sin motivo la vuelve a mostrar."""
    oculta = {"motivo": motivo.strip(), "por": equipo["user_id"], "en": ahora()} if motivo else None
    doc = db.resenas.find_one_and_update({"_id": resena_id}, {"$set": {"oculta": oculta}}, return_document=True)
    if not doc:
        raise error(status.HTTP_404_NOT_FOUND, "Reseña no encontrada")
    recalcular_metricas(db, doc["maquiladora_id"])
    return a_resena(doc, privado=True)
