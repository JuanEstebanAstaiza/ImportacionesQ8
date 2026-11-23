"""Estudio de marca del cliente: su kit (nombre, logo, paleta, tipografías y archivos)
y la ruta legal para vender con marca propia.

- Una cuenta de cliente (cotizante o empresa) tiene hasta `marcas_max` marcas.
- La ruta legal son los pasos de `parametros.ruta_legal` que aplican a la categoría de
  la marca; el cliente marca su avance en cada uno (pendiente, en curso, hecho, no aplica).
- Al pedir una fabricación, el cliente puede adjuntar una marca: la solicitud guarda una
  copia (logo, paleta, tipografías y archivos) y la maquila la ve con el resto del brief.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import status
from pymongo.database import Database

from maquilas import acceso, archivos, parametros
from maquilas.comun import ahora, error, iso, nuevo_id
from maquilas.esquemas import MarcaEntrada, PasoRutaEntrada

ETIQUETAS_PASO = {"pendiente": "Pendiente", "en_curso": "En curso", "hecho": "Hecho", "no_aplica": "No aplica"}


def _cuenta(usuario: dict) -> str:
    cuenta = acceso.cuenta_cliente(usuario)
    if not cuenta:
        raise error(status.HTTP_403_FORBIDDEN, "El estudio de marca es para los clientes")
    return cuenta


def _marca(db: Database, usuario: dict, marca_id: str) -> Dict:
    doc = db.marcas.find_one({"_id": marca_id, "cuenta_cliente": _cuenta(usuario)})
    if not doc:
        raise error(status.HTTP_404_NOT_FOUND, "Marca no encontrada")
    return doc


def ruta(db: Database, doc: Dict) -> List[Dict]:
    avance = doc.get("ruta_legal") or {}
    salida = []
    for paso in parametros.ruta_para(db, doc.get("categoria")):
        estado = avance.get(paso["clave"]) or {}
        salida.append({**{k: paso.get(k) for k in ("clave", "nombre", "descripcion", "enlace")},
                       "estado": estado.get("estado", "pendiente"), "nota": estado.get("nota", ""),
                       "actualizado_en": iso(estado.get("actualizado_en"))})
    return salida


def a_marca(db: Database, doc: Dict, *, completa: bool = True) -> Dict[str, Any]:
    nombres_cat = {c["clave"]: c["nombre"] for c in parametros.leer(db)["categorias"]}
    pasos = ruta(db, doc)
    resueltos = sum(1 for p in pasos if p["estado"] in ("hecho", "no_aplica"))
    salida = {
        "id": doc["_id"],
        "nombre": doc["nombre"],
        "eslogan": doc.get("eslogan") or "",
        "categoria": doc.get("categoria"),
        "categoria_nombre": nombres_cat.get(doc.get("categoria") or "", None),
        "logo": archivos.con_url(doc.get("logo")),
        "paleta": doc.get("paleta") or [],
        "ruta_avance": {"hechos": resueltos, "total": len(pasos)},
        "encargos_abiertos": db.encargos.count_documents({"marca_id": doc["_id"], "estado": {"$nin": ["aprobado", "cancelado"]}}),
        "actualizado_en": iso(doc.get("actualizado_en")),
    }
    if completa:
        salida.update({
            "descripcion": doc.get("descripcion") or "",
            "tipografias": doc.get("tipografias") or [],
            "archivos": [archivos.con_url(a) for a in doc.get("archivos") or []],
            "ruta_legal": pasos,
            "creado_en": iso(doc.get("creado_en")),
        })
    return salida


def listar(db: Database, usuario: dict) -> List[Dict]:
    filas = db.marcas.find({"cuenta_cliente": _cuenta(usuario)}).sort("creado_en", -1)
    return [a_marca(db, d, completa=False) for d in filas]


def detalle(db: Database, usuario: dict, marca_id: str) -> Dict:
    return a_marca(db, _marca(db, usuario, marca_id))


def _campos(db: Database, cuenta: str, marca_id: str, datos: MarcaEntrada, actual: Optional[Dict]) -> Dict:
    p = parametros.leer(db)
    if datos.categoria and datos.categoria not in {c["clave"] for c in p["categorias"]}:
        raise error(status.HTTP_400_BAD_REQUEST, "Esa categoría no existe")
    if len(datos.paleta) > int(p["paleta_max"]):
        raise error(status.HTTP_400_BAD_REQUEST, f"La paleta admite hasta {p['paleta_max']} colores")
    if len(datos.archivos) > int(p["archivos_marca_max"]):
        raise error(status.HTTP_400_BAD_REQUEST, f"Máximo {p['archivos_marca_max']} archivos por marca")
    contexto = {"marca_id": marca_id}
    # Lo que ya estaba en la marca (incluidas las entregas aprobadas de un encargo) se conserva tal cual.
    previos = {a["id"]: a for a in (actual or {}).get("archivos") or []}
    logo_previo = (actual or {}).get("logo")
    try:
        nuevos = [i for i in datos.archivos if i not in previos]
        ligados = {a["id"]: a for a in archivos.ligar(db, ids=nuevos, tipo="marca_archivo", cuenta=cuenta, contexto=contexto)}
        lista = [previos.get(i) or ligados[i] for i in datos.archivos]
        if datos.logo and logo_previo and datos.logo == logo_previo["id"]:
            logo = logo_previo
        elif datos.logo:
            logo = archivos.ligar(db, ids=[datos.logo], tipo="marca", cuenta=cuenta, contexto=contexto)[0]
        else:
            logo = None
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    return {
        "nombre": datos.nombre.strip(),
        "eslogan": datos.eslogan.strip(),
        "descripcion": datos.descripcion.strip(),
        "categoria": datos.categoria or None,
        "logo": logo,
        "paleta": [{"nombre": c.nombre.strip(), "hex": c.hex.upper()} for c in datos.paleta],
        "tipografias": datos.tipografias,
        "archivos": lista,
        "actualizado_en": ahora(),
    }


def crear(db: Database, usuario: dict, datos: MarcaEntrada) -> Dict:
    cuenta = _cuenta(usuario)
    maximo = int(parametros.leer(db)["marcas_max"])
    if db.marcas.count_documents({"cuenta_cliente": cuenta}) >= maximo:
        raise error(status.HTTP_409_CONFLICT, f"Puedes tener hasta {maximo} marcas")
    marca_id = nuevo_id()
    doc = {"_id": marca_id, "cuenta_cliente": cuenta, "creado_por": usuario["user_id"], "creado_en": ahora(),
           "ruta_legal": {}, **_campos(db, cuenta, marca_id, datos, None)}
    db.marcas.insert_one(doc)
    return a_marca(db, doc)


def actualizar(db: Database, usuario: dict, marca_id: str, datos: MarcaEntrada) -> Dict:
    doc = _marca(db, usuario, marca_id)
    db.marcas.update_one({"_id": marca_id}, {"$set": _campos(db, doc["cuenta_cliente"], marca_id, datos, doc)})
    return a_marca(db, db.marcas.find_one({"_id": marca_id}))


def marcar_paso(db: Database, usuario: dict, marca_id: str, clave: str, datos: PasoRutaEntrada) -> Dict:
    doc = _marca(db, usuario, marca_id)
    if clave not in {p["clave"] for p in parametros.ruta_para(db, doc.get("categoria"))}:
        raise error(status.HTTP_404_NOT_FOUND, "Ese paso no está en la ruta de esta marca")
    db.marcas.update_one({"_id": marca_id}, {"$set": {f"ruta_legal.{clave}": {
        "estado": datos.estado, "nota": datos.nota.strip(), "actualizado_en": ahora(), "por": usuario["user_id"]}}})
    return a_marca(db, db.marcas.find_one({"_id": marca_id}))


# ── En una solicitud ─────────────────────────────────────────────────────────

def snapshot(db: Database, usuario: dict, marca_id: str) -> Dict:
    """Copia de la marca para adjuntarla a una solicitud (la maquila ve esto, no la marca viva)."""
    doc = _marca(db, usuario, marca_id)
    refs = ([doc["logo"]] if doc.get("logo") else []) + list(doc.get("archivos") or [])
    return {"id": doc["_id"], "nombre": doc["nombre"], "eslogan": doc.get("eslogan") or "", "logo": doc.get("logo"),
            "paleta": doc.get("paleta") or [], "tipografias": doc.get("tipografias") or [],
            "archivos": list(doc.get("archivos") or []), "archivos_ids": [r["id"] for r in refs]}


def snapshot_con_url(marca: Optional[Dict]) -> Optional[Dict]:
    if not marca:
        return None
    return {k: v for k, v in marca.items() if k != "archivos_ids"} | {
        "logo": archivos.con_url(marca.get("logo")), "archivos": [archivos.con_url(a) for a in marca.get("archivos") or []]}
