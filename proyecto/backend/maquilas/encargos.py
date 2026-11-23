"""Encargos de diseño: el cliente le pide al equipo de Diseño de Zarpi una pieza de su
marca (logo, etiqueta, empaque…) y la aprueba por versiones.

Ciclo:
- `nuevo`: el cliente lo pidió desde su marca, con un brief y referencias.
- `en_proceso`: un diseñador lo tomó (queda asignado a él).
- `entregado`: el diseñador subió una versión; espera la respuesta del cliente.
- `cambios`: el cliente pidió ajustes (con comentario); el diseñador sube otra versión.
- `aprobado`: el cliente aprobó una versión. Sus archivos pasan a la marca (si es un
  logo y la versión trae una imagen, queda como el logo de la marca).
- `cancelado`: el cliente lo retiró antes de que lo tomaran.

Zarpi no cobra el encargo desde aquí: el valor, si lo hay, se acuerda aparte.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import status
from pymongo import ReturnDocument
from pymongo.database import Database
from sqlalchemy.orm import Session

from maquilas import acceso, archivos, avisos, parametros
from maquilas.comun import ahora, codigo, error, iso, nuevo_id
from maquilas.esquemas import EncargoEntrada, RespuestaEncargoEntrada, VersionEntrada
from maquilas.identidad import es_disenador, es_equipo

ETIQUETAS = {
    "nuevo": "Esperando diseñador",
    "en_proceso": "En diseño",
    "entregado": "Por revisar",
    "cambios": "Ajustando",
    "aprobado": "Aprobado",
    "cancelado": "Cancelado",
}
ABIERTOS = ("nuevo", "en_proceso", "entregado", "cambios")


def _nombre_usuario(sql: Session, usuario_id: Optional[str]) -> Optional[str]:
    if not usuario_id or sql is None:
        return None
    from models.usuario import Usuario

    fila = sql.query(Usuario.nombre, Usuario.apellido).filter(Usuario.id == usuario_id).first()
    return " ".join(x for x in (fila[0], fila[1]) if x) if fila else None


def a_encargo(db: Database, doc: Dict, usuario: dict, sql: Optional[Session] = None) -> Dict[str, Any]:
    tipos = {t["clave"]: t["nombre"] for t in parametros.leer(db)["tipos_encargo"]}
    lado = "cliente" if acceso.cuenta_cliente(usuario) else "diseno"
    ultima = (doc.get("versiones") or [None])[-1]
    acciones = {}
    if lado == "cliente":
        acciones = {"responder": doc["estado"] == "entregado", "cancelar": doc["estado"] == "nuevo"}
    elif es_disenador(usuario):
        mio = doc.get("disenador_id") == usuario["user_id"]
        acciones = {"tomar": doc["estado"] == "nuevo",
                    "entregar": mio and doc["estado"] in ("en_proceso", "cambios")
                    and len(doc.get("versiones") or []) < int(parametros.leer(db)["versiones_max"])}
    marca = db.marcas.find_one({"_id": doc["marca_id"]}, {"nombre": 1, "logo": 1, "paleta": 1, "tipografias": 1, "eslogan": 1}) or {}
    return {
        "id": doc["_id"],
        "codigo": doc["codigo"],
        "tipo": doc["tipo"],
        "tipo_nombre": tipos.get(doc["tipo"], doc["tipo"]),
        "estado": doc["estado"],
        "estado_etiqueta": ETIQUETAS.get(doc["estado"], doc["estado"]),
        "brief": doc["brief"],
        "referencias": [archivos.con_url(r) for r in doc.get("referencias") or []],
        "marca": {"id": doc["marca_id"], "nombre": marca.get("nombre"), "eslogan": marca.get("eslogan") or "",
                  "logo": archivos.con_url(marca.get("logo")), "paleta": marca.get("paleta") or [],
                  "tipografias": marca.get("tipografias") or []},
        "cliente": doc.get("cliente") or {},
        "disenador": {"id": doc.get("disenador_id"), "nombre": doc.get("disenador_nombre")} if doc.get("disenador_id") else None,
        "versiones": [{**v, "archivos": [archivos.con_url(a) for a in v.get("archivos") or []], "entregada_en": iso(v.get("entregada_en")),
                       "respondida_en": iso(v.get("respondida_en"))} for v in doc.get("versiones") or []],
        "version_vigente": ultima["numero"] if ultima else None,
        "acciones": acciones,
        "creado_en": iso(doc.get("creado_en")),
        "actualizado_en": iso(doc.get("actualizado_en")),
        "aprobado_en": iso(doc.get("aprobado_en")),
    }


def _resumen(db: Database, doc: Dict, usuario: dict) -> Dict:
    item = a_encargo(db, doc, usuario)
    return {k: item[k] for k in ("id", "codigo", "tipo_nombre", "estado", "estado_etiqueta", "marca", "cliente", "disenador",
                                 "version_vigente", "creado_en", "actualizado_en")} | {
        "pendiente_de_mi": any(item["acciones"].values()) and not item["acciones"].get("cancelar")}


# ── Cliente ──────────────────────────────────────────────────────────────────

def crear(db: Database, sql: Session, usuario: dict, marca_id: str, datos: EncargoEntrada) -> Dict:
    from maquilas.solicitudes import _cliente_snapshot

    cuenta = acceso.cuenta_cliente(usuario)
    marca = db.marcas.find_one({"_id": marca_id, "cuenta_cliente": cuenta}) if cuenta else None
    if not marca:
        raise error(status.HTTP_404_NOT_FOUND, "Marca no encontrada")
    if datos.tipo not in {t["clave"] for t in parametros.leer(db)["tipos_encargo"]}:
        raise error(status.HTTP_400_BAD_REQUEST, "Ese tipo de diseño no existe")
    if db.encargos.count_documents({"cuenta_cliente": cuenta, "estado": {"$in": list(ABIERTOS)}}) >= 5:
        raise error(status.HTTP_409_CONFLICT, "Tienes 5 encargos abiertos. Cierra alguno antes de pedir otro.")
    encargo_id = nuevo_id()
    try:
        refs = archivos.ligar(db, ids=datos.referencias, tipo="marca_archivo", cuenta=cuenta, contexto={"encargo_id": encargo_id})
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    momento = ahora()
    doc = {"_id": encargo_id, "codigo": codigo("DM", encargo_id), "cuenta_cliente": cuenta, "marca_id": marca_id,
           "cliente": _cliente_snapshot(sql, usuario), "creado_por": usuario["user_id"], "tipo": datos.tipo,
           "brief": datos.brief.strip(), "referencias": refs, "estado": "nuevo", "versiones": [],
           "disenador_id": None, "creado_en": momento, "actualizado_en": momento}
    db.encargos.insert_one(doc)
    avisos.avisar(sql, avisos.usuarios_del_equipo(sql, ("designer",)), tipo="maquila_encargo",
                  titulo="Nuevo encargo de diseño", mensaje=f"{marca['nombre']}: {doc['brief'][:120]}",
                  data={"evento": "maquila_encargo", "encargo_id": encargo_id, "lado_destino": "diseno"})
    return a_encargo(db, doc, usuario)


def mis_encargos(db: Database, usuario: dict, marca_id: Optional[str] = None) -> List[Dict]:
    cuenta = acceso.cuenta_cliente(usuario)
    if not cuenta:
        raise error(status.HTTP_403_FORBIDDEN, "Solo los clientes piden encargos de diseño")
    filtro: Dict[str, Any] = {"cuenta_cliente": cuenta}
    if marca_id:
        filtro["marca_id"] = marca_id
    return [_resumen(db, d, usuario) for d in db.encargos.find(filtro).sort("creado_en", -1).limit(200)]


def _encargo(db: Database, usuario: dict, encargo_id: str) -> Dict:
    doc = db.encargos.find_one({"_id": encargo_id})
    cuenta = acceso.cuenta_cliente(usuario)
    if not doc or not (es_disenador(usuario) or es_equipo(usuario) or (cuenta and cuenta == doc["cuenta_cliente"])):
        raise error(status.HTTP_404_NOT_FOUND, "Encargo no encontrado")
    return doc


def detalle(db: Database, usuario: dict, encargo_id: str) -> Dict:
    return a_encargo(db, _encargo(db, usuario, encargo_id), usuario)


def _guardar(db: Database, encargo_id: str, filtro: Dict, cambios: Dict) -> Dict:
    doc = db.encargos.find_one_and_update({"_id": encargo_id, **filtro},
                                          {**cambios, "$set": {**cambios.get("$set", {}), "actualizado_en": ahora()}},
                                          return_document=ReturnDocument.AFTER)
    if not doc:
        raise error(status.HTTP_409_CONFLICT, "El encargo cambió mientras tanto. Recarga e intenta de nuevo.")
    return doc


def cancelar(db: Database, usuario: dict, encargo_id: str) -> Dict:
    doc = _encargo(db, usuario, encargo_id)
    if not acceso.cuenta_cliente(usuario):
        raise error(status.HTTP_403_FORBIDDEN, "Solo el cliente cancela su encargo")
    if doc["estado"] != "nuevo":
        raise error(status.HTTP_409_CONFLICT, "Un diseñador ya lo tomó; pídele por el comentario lo que necesites")
    return a_encargo(db, _guardar(db, encargo_id, {"estado": "nuevo"}, {"$set": {"estado": "cancelado"}}), usuario)


def responder(db: Database, sql: Session, usuario: dict, encargo_id: str, datos: RespuestaEncargoEntrada) -> Dict:
    doc = _encargo(db, usuario, encargo_id)
    if not acceso.cuenta_cliente(usuario) or doc["estado"] != "entregado":
        raise error(status.HTTP_409_CONFLICT, "No hay una versión esperando tu respuesta")
    comentario = datos.comentario.strip()
    if not datos.aprobado and len(comentario) < 5:
        raise error(status.HTTP_400_BAD_REQUEST, "Cuéntale al diseñador qué cambiar")
    i = len(doc["versiones"]) - 1
    version = doc["versiones"][i]
    cambios: Dict[str, Any] = {f"versiones.{i}.estado": "aprobada" if datos.aprobado else "cambios",
                               f"versiones.{i}.comentario": comentario, f"versiones.{i}.respondida_en": ahora(),
                               "estado": "aprobado" if datos.aprobado else "cambios"}
    if datos.aprobado:
        cambios["aprobado_en"] = ahora()
    actualizado = _guardar(db, encargo_id, {"estado": "entregado", f"versiones.{i}.estado": "enviada"}, {"$set": cambios})
    if datos.aprobado:
        _pasar_a_la_marca(db, doc, version)
    avisos.avisar(sql, [doc["disenador_id"]] if doc.get("disenador_id") else [], tipo="maquila_encargo_respuesta",
                  titulo="Aprobaron tu diseño" if datos.aprobado else "Piden cambios a tu diseño",
                  mensaje=f"{doc['codigo']}: {comentario or 'versión ' + str(version['numero']) + ' aprobada'}"[:160],
                  data={"evento": "maquila_encargo_respuesta", "encargo_id": encargo_id, "lado_destino": "diseno"})
    return a_encargo(db, actualizado, usuario)


def _pasar_a_la_marca(db: Database, encargo: Dict, version: Dict) -> None:
    """Los archivos aprobados quedan en la marca; en un logo, la primera imagen es el logo."""
    marca = db.marcas.find_one({"_id": encargo["marca_id"]}) or {}
    existentes = {a["id"] for a in marca.get("archivos") or []}
    nuevos = [a for a in version.get("archivos") or [] if a["id"] not in existentes]
    cambios: Dict[str, Any] = {"actualizado_en": ahora()}
    imagen = next((a for a in version.get("archivos") or [] if str(a.get("content_type", "")).startswith("image/")), None)
    if encargo["tipo"] == "logo" and imagen:
        cambios["logo"] = imagen
    operacion: Dict[str, Any] = {"$set": cambios}
    if nuevos:
        operacion["$push"] = {"archivos": {"$each": nuevos}}
    db.marcas.update_one({"_id": encargo["marca_id"]}, operacion)


# ── Equipo de Diseño ─────────────────────────────────────────────────────────

def cola(db: Database, usuario: dict, *, estado: Optional[str] = None, mios: bool = False) -> List[Dict]:
    filtro: Dict[str, Any] = {}
    if estado == "abiertos":
        filtro["estado"] = {"$in": list(ABIERTOS)}
    elif estado:
        filtro["estado"] = estado
    if mios:
        filtro["disenador_id"] = usuario["user_id"]
    filas = db.encargos.find(filtro).sort([("estado", 1), ("actualizado_en", 1)]).limit(300)
    return [_resumen(db, d, usuario) for d in filas]


def tomar(db: Database, sql: Session, usuario: dict, encargo_id: str) -> Dict:
    doc = _encargo(db, usuario, encargo_id)
    nombre = _nombre_usuario(sql, usuario["user_id"]) or "Diseño Zarpi"
    actualizado = _guardar(db, encargo_id, {"estado": "nuevo"}, {"$set": {
        "estado": "en_proceso", "disenador_id": usuario["user_id"], "disenador_nombre": nombre, "tomado_en": ahora()}})
    avisos.avisar(sql, avisos.usuarios_de_cliente(sql, doc["cuenta_cliente"]), tipo="maquila_encargo_tomado",
                  titulo="Un diseñador tomó tu encargo", mensaje=f"{nombre} está trabajando en {doc['codigo']}.",
                  data={"evento": "maquila_encargo_tomado", "encargo_id": encargo_id, "lado_destino": "cliente"})
    return a_encargo(db, actualizado, usuario)


def entregar(db: Database, sql: Session, usuario: dict, encargo_id: str, datos: VersionEntrada) -> Dict:
    doc = _encargo(db, usuario, encargo_id)
    if doc.get("disenador_id") != usuario["user_id"]:
        raise error(status.HTTP_403_FORBIDDEN, "Este encargo lo atiende otro diseñador")
    if doc["estado"] not in ("en_proceso", "cambios"):
        raise error(status.HTTP_409_CONFLICT, "El cliente todavía está revisando la versión anterior")
    numero = len(doc.get("versiones") or []) + 1
    if numero > int(parametros.leer(db)["versiones_max"]):
        raise error(status.HTTP_409_CONFLICT, "Se alcanzó el máximo de versiones de este encargo")
    try:
        refs = archivos.ligar(db, ids=datos.archivos, tipo="diseno", cuenta=f"usuario:{usuario['user_id']}",
                              contexto={"encargo_id": encargo_id})
    except archivos.ArchivoInvalido as exc:
        raise error(status.HTTP_400_BAD_REQUEST, str(exc))
    version = {"numero": numero, "archivos": refs, "nota": datos.nota.strip(), "estado": "enviada", "comentario": "",
               "entregada_en": ahora(), "respondida_en": None}
    actualizado = _guardar(db, encargo_id, {"estado": {"$in": ["en_proceso", "cambios"]}, "versiones": {"$size": numero - 1}},
                           {"$set": {"estado": "entregado"}, "$push": {"versiones": version}})
    avisos.avisar(sql, avisos.usuarios_de_cliente(sql, doc["cuenta_cliente"]), tipo="maquila_encargo_version",
                  titulo="Tienes una propuesta de diseño", mensaje=f"{doc['codigo']}: revisa la versión {numero} y apruébala o pide cambios.",
                  data={"evento": "maquila_encargo_version", "encargo_id": encargo_id, "lado_destino": "cliente"}, correo=True)
    return a_encargo(db, actualizado, usuario)
