"""Reglas de negocio de Zarpi Liquidaciones.

Ciclo de un lote:
    en_revision → publicado → reservado → vendido
         ↓            ↓           ↓
     rechazado   cerrado_sin_venta  (cancelada o vencida la reserva: vuelve a publicado)

- El vendedor publica; el equipo de Zarpi revisa y aprueba o rechaza con motivos.
- Precio fijo: el primero en dar clic en «Comprar lote» lo reserva.
- El vendedor tiene `horas_para_confirmar` (48 h) para marcarlo vendido; si no,
  la reserva vence y el lote vuelve a estar disponible.
- Zarpi no recibe el dinero ni mueve la mercancía: pago y entrega son entre las
  partes, que se coordinan por el chat de la operación.

Los vencimientos se aplican de forma perezosa (`vencer_pendientes`) al leer, en
vez de con una tarea programada: así el estado siempre es correcto cuando
alguien lo mira, sin depender de que un proceso aparte esté vivo.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from sqlalchemy.orm import Session

from liquidaciones import archivos, avisos, parametros
from liquidaciones.db import BUCKET_DOCUMENTOS, BUCKET_MEDIOS
from liquidaciones.identidad import ROLES_CLIENTE, cuenta_de, es_empresa, es_equipo

ESTADOS_LOTE = ("en_revision", "publicado", "rechazado", "reservado", "vendido", "cerrado_sin_venta")
ESTADOS_EN_CATALOGO = ("publicado", "reservado")
MAX_MENSAJES = 500


def _ahora() -> datetime:
    return datetime.utcnow()


def _iso(fecha: Optional[datetime]) -> Optional[str]:
    # Las fechas se guardan en UTC sin zona; la «Z» evita que el navegador las
    # lea como hora local y descuadre las cuentas regresivas.
    return f"{fecha.isoformat(timespec='seconds')}Z" if fecha else None


def _error(codigo: int, detalle: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=detalle)


# ==================== Activación ====================

def obtener_activacion(db: Database, cuenta: str) -> Optional[Dict]:
    return db.activaciones.find_one({"_id": cuenta})


def prellenado(sql: Session, usuario: dict) -> Dict[str, Any]:
    """Datos que la plataforma ya conoce, para no volver a pedirlos."""
    from models.importador import Importador
    from models.usuario import Usuario

    fila = sql.query(Usuario).filter(Usuario.id == usuario["user_id"]).first()
    datos: Dict[str, Any] = {
        "razon_social": "", "nit": "", "tipo_persona": "juridica", "contacto": "",
        "ciudad": "", "direccion": "", "telefono": "", "email": "",
    }
    if fila:
        datos.update({
            "razon_social": fila.razon_social or "",
            "nit": fila.nit or "",
            "tipo_persona": fila.tipo_persona or "juridica",
            "contacto": fila.nombre or "",
            "telefono": f"{fila.indicativo_pais_telefono or ''} {fila.telefono or ''}".strip(),
            "email": fila.email,
        })
    if es_empresa(usuario):
        empresa = sql.query(Importador).filter(Importador.id == usuario["importador_id"]).first()
        if empresa:
            datos["razon_social"] = empresa.nombre_empresa
            datos["tipo_persona"] = "juridica"
    return datos


def a_activacion(doc: Dict, *, privado: bool = True) -> Dict:
    salida = {
        "cuenta": doc["_id"],
        "razon_social": doc.get("razon_social"),
        "nit": doc.get("nit"),
        "tipo_persona": doc.get("tipo_persona"),
        "contacto": doc.get("contacto"),
        "ciudad": doc.get("ciudad"),
        "direccion": doc.get("direccion"),
        "telefono": doc.get("telefono"),
        "email": doc.get("email"),
        "es_empresa": doc["_id"].startswith("empresa:"),
        "suspendida": bool(doc.get("suspendida")),
        "activada_en": _iso(doc.get("declaracion_aceptada_en")),
    }
    if privado:
        salida["rut"] = archivos.ref_documento(doc.get("rut"))
        salida["motivo_suspension"] = doc.get("motivo_suspension")
    return salida


def activar(db: Database, sql: Session, usuario: dict, datos) -> Dict:
    if usuario["rol"] not in ROLES_CLIENTE:
        raise _error(status.HTTP_403_FORBIDDEN, "El equipo de Zarpi no opera en Liquidaciones")
    cuenta = cuenta_de(usuario)
    try:
        rut = archivos.reclamar(db, ids=[datos.rut_archivo_id], tipo="rut", cuenta=cuenta)[0]
    except archivos.ArchivoInvalido as exc:
        raise _error(status.HTTP_400_BAD_REQUEST, str(exc))

    email = prellenado(sql, usuario).get("email")
    ahora = _ahora()
    db.activaciones.update_one(
        {"_id": cuenta},
        {
            "$set": {
                "razon_social": datos.razon_social.strip(),
                "nit": datos.nit.strip(),
                "tipo_persona": datos.tipo_persona,
                "contacto": datos.contacto.strip(),
                "ciudad": datos.ciudad.strip(),
                "direccion": datos.direccion.strip(),
                "telefono": datos.telefono.strip(),
                "email": email,
                "rut": rut,
                "declaracion_aceptada_en": ahora,
                "activada_por": usuario["user_id"],
                "actualizado_en": ahora,
            },
            "$setOnInsert": {"suspendida": False, "creada_en": ahora},
        },
        upsert=True,
    )
    return a_activacion(obtener_activacion(db, cuenta))


def requerir_activa(db: Database, usuario: dict) -> Dict:
    activacion = obtener_activacion(db, cuenta_de(usuario))
    if not activacion:
        raise _error(status.HTTP_403_FORBIDDEN, "Activa tu cuenta de Liquidaciones para continuar")
    if activacion.get("suspendida"):
        raise _error(status.HTTP_403_FORBIDDEN,
                     "Tu cuenta de Liquidaciones está suspendida. Escríbenos desde Soporte técnico.")
    return activacion


def _contacto_publico(activacion: Optional[Dict]) -> Optional[Dict]:
    if not activacion:
        return None
    return {
        "razon_social": activacion.get("razon_social"),
        "nit": activacion.get("nit"),
        "contacto": activacion.get("contacto"),
        "telefono": activacion.get("telefono"),
        "email": activacion.get("email"),
        "direccion": activacion.get("direccion"),
        "ciudad": activacion.get("ciudad"),
    }


# ==================== Vencimientos ====================

def vencer_pendientes(db: Database, sql: Optional[Session] = None) -> None:
    ahora = _ahora()
    for op in db.operaciones.find({"estado": "activa", "vence_en": {"$lte": ahora}}):
        cambio = db.operaciones.update_one(
            {"_id": op["_id"], "estado": "activa"},
            {"$set": {"estado": "vencida", "cerrada_en": ahora}},
        )
        if not cambio.modified_count:
            continue
        lote = db.lotes.find_one({"_id": op["lote_id"]}) or {}
        nuevo = "cerrado_sin_venta" if lote.get("cierra_en") and lote["cierra_en"] <= ahora else "publicado"
        db.lotes.update_one({"_id": op["lote_id"], "estado": "reservado"},
                            {"$set": {"estado": nuevo, "actualizado_en": ahora}})
        _mensaje_sistema(db, op["_id"], "La reserva venció sin marcarse como vendida. El lote volvió a estar disponible.")
        avisos.avisar(sql, cuenta=op["cuenta_comprador"], tipo="liquidacion_reserva_vencida",
                      titulo="Tu reserva venció", mensaje=f"La reserva de «{op['lote']['nombre']}» venció.",
                      data={"operacion_id": op["_id"], "lado": "comprador"})
        avisos.avisar(sql, cuenta=op["cuenta_vendedor"], tipo="liquidacion_reserva_vencida",
                      titulo="Una reserva venció", data={"lote_id": op["lote_id"]},
                      mensaje=f"«{op['lote']['nombre']}» volvió a estar disponible.")

    db.lotes.update_many(
        {"estado": "publicado", "cierra_en": {"$lte": ahora}},
        {"$set": {"estado": "cerrado_sin_venta", "actualizado_en": ahora}},
    )


# ==================== Lotes ====================

def _medios(ids: List[str]) -> List[Dict]:
    return [{"id": i, "url": archivos.url_de(BUCKET_MEDIOS, i)} for i in ids or []]


def a_lote(lote: Dict, usuario: Optional[dict] = None) -> Dict:
    propio = bool(usuario and lote.get("cuenta_vendedor") == cuenta_de(usuario))
    privado = propio or bool(usuario and es_equipo(usuario))
    unidades = max(int(lote.get("unidades") or 1), 1)
    salida = {
        "id": lote["_id"],
        "nombre": lote["nombre"],
        "descripcion": lote.get("descripcion") or "",
        "categoria": lote.get("categoria"),
        "unidades": lote.get("unidades"),
        "unidad_venta": lote.get("unidad_venta") or "unidades",
        "condicion": lote.get("condicion"),
        "detalle_condicion": lote.get("detalle_condicion"),
        "fotos": _medios(lote.get("fotos")),
        "videos": _medios(lote.get("videos")),
        "ficha_tecnica": archivos.ref_documento(lote.get("ficha_tecnica")),
        "precio_cop": lote.get("precio_cop"),
        "precio_unidad_cop": int(lote.get("precio_cop") or 0) // unidades,
        "ciudad": lote.get("ciudad"),
        "entrega": lote.get("entrega"),
        "requiere_registro_sanitario": bool(lote.get("requiere_registro_sanitario")),
        "registro_sanitario": lote.get("registro_sanitario"),
        "dias_cierre": lote.get("dias_cierre"),
        "cierra_en": _iso(lote.get("cierra_en")),
        "destacado": bool(lote.get("destacado")),
        "estado": lote.get("estado"),
        "vendedor": {
            "razon_social": (lote.get("vendedor") or {}).get("razon_social"),
            "nit": (lote.get("vendedor") or {}).get("nit"),
            "ciudad": (lote.get("vendedor") or {}).get("ciudad"),
        },
        "es_mio": propio,
        "publicado_en": _iso(lote.get("publicado_en")),
        "enviado_en": _iso(lote.get("enviado_en")),
        "creado_en": _iso(lote.get("creado_en")),
    }
    if privado:
        rechazo = lote.get("rechazo")
        salida["rechazo"] = {
            "motivos": rechazo.get("motivos", []),
            "nota": rechazo.get("nota"),
            "fecha": _iso(rechazo.get("fecha")),
        } if rechazo else None
        salida["cuenta_vendedor"] = lote.get("cuenta_vendedor")
    return salida


def _validar_lote(db: Database, datos, cuenta: str, lote_id: str) -> Optional[Dict]:
    """Valida contra los parámetros del módulo y liga los archivos al lote.
    Devuelve la referencia de la ficha técnica, si la hay."""
    p = parametros.leer(db)
    if not p["fotos_min"] <= len(datos.fotos) <= p["fotos_max"]:
        raise _error(status.HTTP_400_BAD_REQUEST,
                     f"Sube entre {p['fotos_min']} y {p['fotos_max']} fotos reales del lote")
    if len(datos.videos) > p["videos_max"]:
        raise _error(status.HTTP_400_BAD_REQUEST, f"Puedes adjuntar hasta {p['videos_max']} videos")
    if datos.categoria not in p["categorias"]:
        raise _error(status.HTTP_400_BAD_REQUEST, "Elige una categoría de la lista")
    if datos.dias_cierre > p["dias_max_cierre"]:
        raise _error(status.HTTP_400_BAD_REQUEST,
                     f"La fecha de cierre puede ser de hasta {p['dias_max_cierre']} días")
    try:
        archivos.reclamar(db, ids=datos.fotos, tipo="foto", cuenta=cuenta, lote_id=lote_id)
        archivos.reclamar(db, ids=datos.videos, tipo="video", cuenta=cuenta, lote_id=lote_id)
        if datos.ficha_tecnica_id:
            return archivos.reclamar(db, ids=[datos.ficha_tecnica_id], tipo="ficha_tecnica", cuenta=cuenta,
                                     lote_id=lote_id)[0]
    except archivos.ArchivoInvalido as exc:
        raise _error(status.HTTP_400_BAD_REQUEST, str(exc))
    return None


def _campos_lote(datos) -> Dict[str, Any]:
    return {
        "nombre": datos.nombre.strip(),
        "descripcion": datos.descripcion.strip(),
        "categoria": datos.categoria,
        "unidades": datos.unidades,
        "unidad_venta": datos.unidad_venta,
        "condicion": datos.condicion,
        "detalle_condicion": (datos.detalle_condicion or "").strip() or None if datos.condicion != "nuevo" else None,
        "fotos": datos.fotos,
        "videos": datos.videos,
        "ficha_tecnica_id": datos.ficha_tecnica_id,
        "precio_cop": datos.precio_cop,
        "ciudad": datos.ciudad.strip(),
        "entrega": datos.entrega,
        "requiere_registro_sanitario": datos.requiere_registro_sanitario,
        "registro_sanitario": (datos.registro_sanitario or "").strip() or None if datos.requiere_registro_sanitario else None,
        "dias_cierre": datos.dias_cierre,
        "destacado": datos.destacado,
    }


def _vendedor_de(activacion: Dict) -> Dict:
    return {"razon_social": activacion.get("razon_social"), "nit": activacion.get("nit"),
            "ciudad": activacion.get("ciudad")}


def _requerir_empresa(usuario: dict) -> None:
    if not es_empresa(usuario):
        raise _error(status.HTTP_403_FORBIDDEN, "Solo las empresas registradas en Zarpi publican lotes")


def crear_lote(db: Database, sql: Session, usuario: dict, datos) -> Dict:
    _requerir_empresa(usuario)
    activacion = requerir_activa(db, usuario)
    cuenta = cuenta_de(usuario)
    lote_id = str(uuid4())
    ficha = _validar_lote(db, datos, cuenta, lote_id)
    ahora = _ahora()
    lote = {
        "_id": lote_id,
        "cuenta_vendedor": cuenta,
        "vendedor": _vendedor_de(activacion),
        "creado_por": usuario["user_id"],
        **_campos_lote(datos),
        "ficha_tecnica": ficha,
        "estado": "en_revision",
        "rechazo": None,
        "cierra_en": None,
        "publicado_en": None,
        "enviado_en": ahora,
        "creado_en": ahora,
        "actualizado_en": ahora,
    }
    db.lotes.insert_one(lote)
    avisos.avisar(sql, usuarios=avisos.usuarios_del_equipo(sql, ("admin", "soporte")),
                  tipo="liquidacion_por_revisar", titulo="Nueva liquidación por revisar",
                  mensaje=f"{activacion.get('razon_social')} envió «{lote['nombre']}».", data={"lote_id": lote_id})
    return a_lote(lote, usuario)


def _lote_propio(db: Database, usuario: dict, lote_id: str) -> Dict:
    lote = db.lotes.find_one({"_id": lote_id})
    if not lote or lote.get("cuenta_vendedor") != cuenta_de(usuario):
        raise _error(status.HTTP_404_NOT_FOUND, "Liquidación no encontrada")
    return lote


def editar_lote(db: Database, sql: Session, usuario: dict, lote_id: str, datos) -> Dict:
    _requerir_empresa(usuario)
    activacion = requerir_activa(db, usuario)
    lote = _lote_propio(db, usuario, lote_id)
    if lote["estado"] not in ("en_revision", "rechazado"):
        raise _error(status.HTTP_409_CONFLICT,
                     "Solo se edita una liquidación pendiente de revisión o rechazada")
    cuenta = cuenta_de(usuario)
    ficha = _validar_lote(db, datos, cuenta, lote_id)

    # Los archivos que se quitaron del lote ya no los ve nadie: se borran.
    anteriores = {
        BUCKET_MEDIOS: set(lote.get("fotos") or []) | set(lote.get("videos") or []),
        BUCKET_DOCUMENTOS: {lote["ficha_tecnica_id"]} if lote.get("ficha_tecnica_id") else set(),
    }
    nuevos = {
        BUCKET_MEDIOS: set(datos.fotos) | set(datos.videos),
        BUCKET_DOCUMENTOS: {datos.ficha_tecnica_id} if datos.ficha_tecnica_id else set(),
    }
    for nombre_bucket, ids in anteriores.items():
        archivos.borrar(db, nombre_bucket, ids - nuevos[nombre_bucket])

    ahora = _ahora()
    cambios = {**_campos_lote(datos), "ficha_tecnica": ficha, "vendedor": _vendedor_de(activacion), "estado": "en_revision",
               "rechazo": None, "enviado_en": ahora, "actualizado_en": ahora}
    db.lotes.update_one({"_id": lote_id}, {"$set": cambios})
    if lote["estado"] == "rechazado":
        avisos.avisar(sql, usuarios=avisos.usuarios_del_equipo(sql, ("admin", "soporte")),
                      tipo="liquidacion_por_revisar", titulo="Liquidación corregida por revisar",
                      mensaje=f"{activacion.get('razon_social')} reenvió «{datos.nombre}».", data={"lote_id": lote_id})
    return a_lote(db.lotes.find_one({"_id": lote_id}), usuario)


def mis_lotes(db: Database, sql: Session, usuario: dict) -> Dict:
    _requerir_empresa(usuario)
    vencer_pendientes(db, sql)
    cuenta = cuenta_de(usuario)
    lotes = list(db.lotes.find({"cuenta_vendedor": cuenta}).sort("actualizado_en", -1).limit(500))
    activas = {
        op["lote_id"]: op
        for op in db.operaciones.find({"cuenta_vendedor": cuenta, "estado": "activa"})
    }
    filas = []
    for lote in lotes:
        fila = a_lote(lote, usuario)
        op = activas.get(lote["_id"])
        fila["operacion"] = {"id": op["_id"], "vence_en": _iso(op["vence_en"])} if op else None
        filas.append(fila)
    contar = lambda estado: sum(1 for l in lotes if l["estado"] == estado)  # noqa: E731
    return {
        "contadores": {
            "disponibles": contar("publicado"),
            "pendientes": contar("en_revision"),
            "reservadas": contar("reservado"),
            "vendidas": contar("vendido"),
        },
        "lotes": filas,
    }


def _filtro_texto(q: Optional[str]) -> Optional[Dict]:
    q = (q or "").strip()[:80]
    if not q:
        return None
    patron = {"$regex": re.escape(q), "$options": "i"}
    return {"$or": [{"nombre": patron}, {"descripcion": patron}, {"categoria": patron},
                    {"vendedor.razon_social": patron}]}


def catalogo(
    db: Database,
    sql: Optional[Session],
    usuario: Optional[dict],
    *,
    q: Optional[str] = None,
    categoria: Optional[str] = None,
    ciudad: Optional[str] = None,
    condicion: Optional[str] = None,
    entrega: Optional[str] = None,
) -> Dict:
    vencer_pendientes(db, sql)
    filtro: Dict[str, Any] = {"estado": {"$in": list(ESTADOS_EN_CATALOGO)}}
    if categoria:
        filtro["categoria"] = categoria
    if ciudad:
        filtro["ciudad"] = ciudad
    if condicion:
        filtro["condicion"] = condicion
    if entrega:
        filtro["entrega"] = entrega
    texto = _filtro_texto(q)
    if texto:
        filtro.update(texto)

    lotes = list(db.lotes.find(filtro).sort([("cierra_en", 1)]).limit(300))
    destacados = [a_lote(l, usuario) for l in lotes if l.get("destacado") and l["estado"] == "publicado"]
    ids_destacados = {d["id"] for d in destacados}
    resto = [a_lote(l, usuario) for l in lotes if l["_id"] not in ids_destacados]
    # Los reservados al final: se ven, pero ya no se pueden comprar.
    resto.sort(key=lambda l: l["estado"] == "reservado")
    return {
        "destacados": destacados,
        "lotes": resto,
        "disponibles": db.lotes.count_documents({"estado": "publicado"}),
        "publicados": db.lotes.count_documents({"estado": {"$in": list(ESTADOS_EN_CATALOGO)}}),
        "ciudades": sorted(c for c in db.lotes.distinct("ciudad", {"estado": {"$in": list(ESTADOS_EN_CATALOGO)}}) if c),
        "categorias": parametros.leer(db)["categorias"],
    }


def vista_publica(db: Database, limite: int) -> List[Dict]:
    vencer_pendientes(db)
    lotes = db.lotes.find({"estado": "publicado"}).sort([("destacado", -1), ("cierra_en", 1)]).limit(limite)
    return [a_lote(l) for l in lotes]


def detalle_lote(db: Database, sql: Optional[Session], usuario: Optional[dict], lote_id: str) -> Dict:
    vencer_pendientes(db, sql)
    lote = db.lotes.find_one({"_id": lote_id})
    if not lote:
        raise _error(status.HTTP_404_NOT_FOUND, "Liquidación no encontrada")
    propio = bool(usuario and lote.get("cuenta_vendedor") == cuenta_de(usuario))
    if lote["estado"] not in archivos.ESTADOS_LOTE_PUBLICOS and not propio and not (usuario and es_equipo(usuario)):
        raise _error(status.HTTP_404_NOT_FOUND, "Liquidación no encontrada")
    salida = a_lote(lote, usuario)
    salida["mi_operacion_id"] = None
    if usuario:
        op = db.operaciones.find_one({"lote_id": lote_id, "cuenta_comprador": cuenta_de(usuario),
                                      "estado": {"$in": ["activa", "vendida"]}})
        salida["mi_operacion_id"] = op["_id"] if op else None
    return salida


# ==================== Revisión (equipo) ====================

def cola_revision(db: Database, usuario: dict) -> List[Dict]:
    lotes = db.lotes.find({"estado": "en_revision"}).sort("enviado_en", 1).limit(200)
    return [a_lote(l, usuario) for l in lotes]


def aprobar(db: Database, sql: Session, usuario: dict, lote_id: str) -> Dict:
    ahora = _ahora()
    lote = db.lotes.find_one({"_id": lote_id, "estado": "en_revision"})
    if not lote:
        raise _error(status.HTTP_409_CONFLICT, "Esta liquidación ya no está pendiente de revisión")
    cierra_en = ahora + timedelta(days=int(lote.get("dias_cierre") or 1))
    db.lotes.update_one(
        {"_id": lote_id, "estado": "en_revision"},
        {"$set": {"estado": "publicado", "publicado_en": ahora, "cierra_en": cierra_en,
                  "revisado_por": usuario["user_id"], "revisado_en": ahora, "actualizado_en": ahora}},
    )
    avisos.avisar(sql, cuenta=lote["cuenta_vendedor"], tipo="liquidacion_aprobada",
                  titulo="Tu liquidación está publicada",
                  mensaje=f"«{lote['nombre']}» pasó la revisión y ya aparece en el catálogo.",
                  data={"lote_id": lote_id}, enlace="/liquidaciones/mis-lotes", externo=True)
    return a_lote(db.lotes.find_one({"_id": lote_id}), usuario)


def rechazar(db: Database, sql: Session, usuario: dict, lote_id: str, motivos: List[str], nota: Optional[str]) -> Dict:
    ahora = _ahora()
    rechazo = {"motivos": motivos, "nota": (nota or "").strip() or None, "fecha": ahora, "por": usuario["user_id"]}
    lote = db.lotes.find_one_and_update(
        {"_id": lote_id, "estado": "en_revision"},
        {"$set": {"estado": "rechazado", "rechazo": rechazo, "revisado_por": usuario["user_id"],
                  "revisado_en": ahora, "actualizado_en": ahora}},
        return_document=ReturnDocument.AFTER,
    )
    if not lote:
        raise _error(status.HTTP_409_CONFLICT, "Esta liquidación ya no está pendiente de revisión")
    avisos.avisar(sql, cuenta=lote["cuenta_vendedor"], tipo="liquidacion_rechazada",
                  titulo="Tu liquidación necesita cambios",
                  mensaje=f"«{lote['nombre']}»: {'; '.join(motivos)}. Corrígela y vuelve a enviarla.",
                  data={"lote_id": lote_id}, enlace="/liquidaciones/mis-lotes", externo=True)
    return a_lote(lote, usuario)


def despublicar(db: Database, sql: Session, usuario: dict, lote_id: str, motivo: str) -> Dict:
    ahora = _ahora()
    rechazo = {"motivos": ["Despublicado por el equipo de Zarpi"], "nota": motivo.strip(), "fecha": ahora,
               "por": usuario["user_id"]}
    lote = db.lotes.find_one_and_update(
        {"_id": lote_id, "estado": "publicado"},
        {"$set": {"estado": "rechazado", "rechazo": rechazo, "destacado": False, "actualizado_en": ahora}},
        return_document=ReturnDocument.AFTER,
    )
    if not lote:
        raise _error(status.HTTP_409_CONFLICT,
                     "Solo se despublica un lote disponible; si está reservado, cancela primero la operación")
    avisos.avisar(sql, cuenta=lote["cuenta_vendedor"], tipo="liquidacion_despublicada",
                  titulo="Despublicamos una de tus liquidaciones", mensaje=f"«{lote['nombre']}»: {motivo}",
                  data={"lote_id": lote_id}, enlace="/liquidaciones/mis-lotes", externo=True)
    return a_lote(lote, usuario)


def destacar(db: Database, usuario: dict, lote_id: str, destacado: bool) -> Dict:
    lote = db.lotes.find_one_and_update(
        {"_id": lote_id},
        {"$set": {"destacado": destacado, "actualizado_en": _ahora()}},
        return_document=ReturnDocument.AFTER,
    )
    if not lote:
        raise _error(status.HTTP_404_NOT_FOUND, "Liquidación no encontrada")
    return a_lote(lote, usuario)


def lotes_admin(db: Database, sql: Session, usuario: dict, *, estado: Optional[str], q: Optional[str],
                limite: int, desde: int) -> Dict:
    vencer_pendientes(db, sql)
    filtro: Dict[str, Any] = {}
    if estado in ESTADOS_LOTE:
        filtro["estado"] = estado
    texto = _filtro_texto(q)
    if texto:
        filtro.update(texto)
    total = db.lotes.count_documents(filtro)
    lotes = db.lotes.find(filtro).sort("actualizado_en", -1).skip(desde).limit(limite)
    return {"total": total, "lotes": [a_lote(l, usuario) for l in lotes]}


# ==================== Operaciones ====================

def _mensaje_sistema(db: Database, operacion_id: str, contenido: str, *, remitente_id: Optional[str] = None,
                     remitente_nombre: Optional[str] = None) -> Dict:
    mensaje = {
        "_id": str(uuid4()),
        "operacion_id": operacion_id,
        "remitente_id": remitente_id,
        "remitente_cuenta": None,
        "remitente_nombre": remitente_nombre,
        "tipo": "sistema",
        "contenido": contenido,
        "archivo": None,
        "fecha": _ahora(),
    }
    db.mensajes.insert_one(mensaje)
    db.operaciones.update_one({"_id": operacion_id}, {"$set": {"ultimo_mensaje_en": mensaje["fecha"]},
                                                       "$inc": {"total_mensajes": 1}})
    return mensaje


def reservar(db: Database, sql: Session, usuario: dict, lote_id: str) -> Dict:
    if usuario["rol"] not in ROLES_CLIENTE:
        raise _error(status.HTTP_403_FORBIDDEN, "El equipo de Zarpi no compra lotes")
    activacion = requerir_activa(db, usuario)
    vencer_pendientes(db, sql)
    cuenta = cuenta_de(usuario)
    ahora = _ahora()

    # El primero en dar clic se lo lleva: la actualización es condicional y
    # atómica, así que de dos clics simultáneos solo uno encuentra el lote publicado.
    lote = db.lotes.find_one_and_update(
        {"_id": lote_id, "estado": "publicado", "cierra_en": {"$gt": ahora}, "cuenta_vendedor": {"$ne": cuenta}},
        {"$set": {"estado": "reservado", "actualizado_en": ahora}},
        return_document=ReturnDocument.AFTER,
    )
    if not lote:
        existente = db.lotes.find_one({"_id": lote_id}, {"cuenta_vendedor": 1, "estado": 1})
        if not existente:
            raise _error(status.HTTP_404_NOT_FOUND, "Liquidación no encontrada")
        if existente.get("cuenta_vendedor") == cuenta:
            raise _error(status.HTTP_400_BAD_REQUEST, "No puedes comprar tu propio lote")
        raise _error(status.HTTP_409_CONFLICT, "Otro comprador reservó este lote primero")

    vendedor = obtener_activacion(db, lote["cuenta_vendedor"]) or {}
    horas = int(parametros.leer(db)["horas_para_confirmar"])
    operacion = {
        "_id": str(uuid4()),
        "lote_id": lote_id,
        "lote": {
            "nombre": lote["nombre"], "unidades": lote["unidades"], "unidad_venta": lote.get("unidad_venta"),
            "precio_cop": lote["precio_cop"], "entrega": lote["entrega"], "ciudad": lote.get("ciudad"),
            "foto": (lote.get("fotos") or [None])[0],
        },
        "cuenta_vendedor": lote["cuenta_vendedor"],
        "cuenta_comprador": cuenta,
        "comprador_usuario_id": usuario["user_id"],
        "vendedor": {"razon_social": vendedor.get("razon_social"), "nit": vendedor.get("nit")},
        "comprador": {"razon_social": activacion.get("razon_social"), "nit": activacion.get("nit")},
        "estado": "activa",
        "reservada_en": ahora,
        "vence_en": ahora + timedelta(hours=horas),
        "comprobantes_pago": [],
        "facturas": [],
        "total_mensajes": 0,
        "ultimo_mensaje_en": ahora,
        "cerrada_en": None,
    }
    try:
        db.operaciones.insert_one(operacion)
    except DuplicateKeyError:
        # Compensación: Mongo sin réplica no tiene transacciones entre documentos.
        db.lotes.update_one({"_id": lote_id, "estado": "reservado"}, {"$set": {"estado": "publicado"}})
        raise _error(status.HTTP_409_CONFLICT, "Otro comprador reservó este lote primero")
    except Exception:
        db.lotes.update_one({"_id": lote_id, "estado": "reservado"}, {"$set": {"estado": "publicado"}})
        raise

    _mensaje_sistema(db, operacion["_id"],
                     f"{activacion.get('razon_social')} reservó el lote. Los datos de contacto ya están visibles "
                     "para las dos partes.")
    avisos.avisar(sql, cuenta=lote["cuenta_vendedor"], tipo="liquidacion_reservada",
                  titulo="Reservaron tu lote",
                  mensaje=f"{activacion.get('razon_social')} reservó «{lote['nombre']}». Tienes {horas} h para "
                          "marcarlo como vendido.",
                  data={"operacion_id": operacion["_id"], "lado": "vendedor"},
                  enlace=f"/liquidaciones/operaciones/{operacion['_id']}", externo=True)
    return detalle_operacion(db, sql, usuario, operacion["_id"], vencer=False)


def _otro_lado(lado: Optional[str]) -> str:
    return "vendedor" if lado == "comprador" else "comprador"


def _lado(operacion: Dict, usuario: dict) -> Optional[str]:
    cuenta = cuenta_de(usuario)
    if cuenta == operacion["cuenta_comprador"]:
        return "comprador"
    if cuenta == operacion["cuenta_vendedor"]:
        return "vendedor"
    if es_equipo(usuario):
        return "equipo"
    return None


def _operacion_visible(db: Database, usuario: dict, operacion_id: str) -> Dict:
    operacion = db.operaciones.find_one({"_id": operacion_id})
    if not operacion or not _lado(operacion, usuario):
        raise _error(status.HTTP_404_NOT_FOUND, "Operación no encontrada")
    return operacion


def a_operacion_resumen(op: Dict, usuario: Optional[dict] = None) -> Dict:
    lado = _lado(op, usuario) if usuario else "equipo"
    contraparte = op.get("vendedor") if lado == "comprador" else op.get("comprador")
    lote = op.get("lote") or {}
    return {
        "id": op["_id"],
        "lote_id": op["lote_id"],
        "lote": {**{k: v for k, v in lote.items() if k != "foto"},
                 "foto": {"id": lote["foto"], "url": archivos.url_de(BUCKET_MEDIOS, lote["foto"])} if lote.get("foto") else None},
        "estado": op["estado"],
        "lado": lado,
        "vendedor": op.get("vendedor"),
        "comprador": op.get("comprador"),
        "contraparte": contraparte,
        "reservada_en": _iso(op.get("reservada_en")),
        "vence_en": _iso(op.get("vence_en")),
        "cerrada_en": _iso(op.get("cerrada_en")),
        "total_mensajes": op.get("total_mensajes", 0),
        "ultimo_mensaje_en": _iso(op.get("ultimo_mensaje_en")),
    }


def a_mensaje(m: Dict, usuario: dict) -> Dict:
    if m["tipo"] == "sistema":
        autor = "equipo" if m.get("remitente_id") else "sistema"
    else:
        autor = "yo" if m.get("remitente_cuenta") == cuenta_de(usuario) else "contraparte"
    return {
        "id": m["_id"],
        "tipo": m["tipo"],
        "autor": autor,
        "remitente_nombre": m.get("remitente_nombre"),
        "contenido": m["contenido"],
        "archivo": m.get("archivo"),
        "fecha": _iso(m["fecha"]),
    }


def detalle_operacion(db: Database, sql: Optional[Session], usuario: dict, operacion_id: str, *,
                      vencer: bool = True) -> Dict:
    if vencer:
        vencer_pendientes(db, sql)
    op = _operacion_visible(db, usuario, operacion_id)
    salida = a_operacion_resumen(op, usuario)
    salida["contactos"] = {
        "vendedor": _contacto_publico(obtener_activacion(db, op["cuenta_vendedor"])),
        "comprador": _contacto_publico(obtener_activacion(db, op["cuenta_comprador"])),
    }
    salida["comprobantes_pago"] = [archivos.ref_documento(r) for r in op.get("comprobantes_pago", [])]
    salida["facturas"] = [archivos.ref_documento(r) for r in op.get("facturas", [])]
    mensajes = db.mensajes.find({"operacion_id": operacion_id}).sort("fecha", 1).limit(MAX_MENSAJES)
    salida["mensajes"] = [a_mensaje(m, usuario) for m in mensajes]
    return salida


def operaciones(db: Database, sql: Session, usuario: dict, lado: str) -> List[Dict]:
    vencer_pendientes(db, sql)
    campo = "cuenta_vendedor" if lado == "vendedor" else "cuenta_comprador"
    filas = db.operaciones.find({campo: cuenta_de(usuario)}).sort("reservada_en", -1).limit(300)
    return [a_operacion_resumen(op, usuario) for op in filas]


def enviar_mensaje(db: Database, sql: Session, usuario: dict, operacion_id: str, contenido: str) -> Dict:
    op = _operacion_visible(db, usuario, operacion_id)
    lado = _lado(op, usuario)
    if lado == "equipo":
        raise _error(status.HTTP_403_FORBIDDEN, "El equipo interviene desde el panel de monitoreo")
    if op["estado"] in ("cancelada", "vencida"):
        raise _error(status.HTTP_409_CONFLICT, "Esta operación está cerrada")
    activacion = obtener_activacion(db, cuenta_de(usuario)) or {}
    mensaje = {
        "_id": str(uuid4()),
        "operacion_id": operacion_id,
        "remitente_id": usuario["user_id"],
        "remitente_cuenta": cuenta_de(usuario),
        "remitente_nombre": activacion.get("contacto") or activacion.get("razon_social"),
        "tipo": "texto",
        "contenido": contenido,
        "archivo": None,
        "fecha": _ahora(),
    }
    db.mensajes.insert_one(mensaje)
    db.operaciones.update_one({"_id": operacion_id}, {"$set": {"ultimo_mensaje_en": mensaje["fecha"]},
                                                       "$inc": {"total_mensajes": 1}})
    otra = op["cuenta_vendedor"] if lado == "comprador" else op["cuenta_comprador"]
    avisos.avisar(sql, cuenta=otra, tipo="liquidacion_mensaje", titulo="Nuevo mensaje en una operación",
                  mensaje=f"«{op['lote']['nombre']}»: {contenido[:120]}",
                  data={"operacion_id": operacion_id, "lado": _otro_lado(lado)})
    return a_mensaje(mensaje, usuario)


def _cerrar_operacion(db: Database, op: Dict, nuevo_estado: str, extra: Dict) -> None:
    ahora = _ahora()
    cambio = db.operaciones.update_one(
        {"_id": op["_id"], "estado": "activa"},
        {"$set": {"estado": nuevo_estado, "cerrada_en": ahora, **extra}},
    )
    if not cambio.modified_count:
        raise _error(status.HTTP_409_CONFLICT, "Esta operación ya no está activa")
    if nuevo_estado == "vendida":
        estado_lote = "vendido"
    else:
        lote = db.lotes.find_one({"_id": op["lote_id"]}, {"cierra_en": 1}) or {}
        estado_lote = "cerrado_sin_venta" if lote.get("cierra_en") and lote["cierra_en"] <= ahora else "publicado"
    db.lotes.update_one({"_id": op["lote_id"], "estado": "reservado"},
                        {"$set": {"estado": estado_lote, "actualizado_en": ahora}})


def marcar_vendido(db: Database, sql: Session, usuario: dict, operacion_id: str) -> Dict:
    vencer_pendientes(db, sql)
    op = _operacion_visible(db, usuario, operacion_id)
    if _lado(op, usuario) != "vendedor":
        raise _error(status.HTTP_403_FORBIDDEN, "Solo el vendedor marca el lote como vendido")
    _cerrar_operacion(db, op, "vendida", {})
    _mensaje_sistema(db, operacion_id, "El vendedor marcó el lote como vendido. Operación cerrada.")
    avisos.avisar(sql, cuenta=op["cuenta_comprador"], tipo="liquidacion_vendida",
                  titulo="Operación cerrada", mensaje=f"El vendedor marcó «{op['lote']['nombre']}» como vendido.",
                  data={"operacion_id": operacion_id, "lado": "comprador"})
    return detalle_operacion(db, sql, usuario, operacion_id, vencer=False)


def cancelar(db: Database, sql: Session, usuario: dict, operacion_id: str, motivo: Optional[str]) -> Dict:
    vencer_pendientes(db, sql)
    op = _operacion_visible(db, usuario, operacion_id)
    lado = _lado(op, usuario)
    motivo = (motivo or "").strip() or None
    _cerrar_operacion(db, op, "cancelada", {"cancelada_por": usuario["user_id"], "cancelada_por_lado": lado,
                                             "motivo_cancelacion": motivo})
    quien = {"comprador": "El comprador", "vendedor": "El vendedor", "equipo": "El equipo de Zarpi"}[lado]
    texto = f"{quien} canceló la reserva." + (f" Motivo: {motivo}" if motivo else "") + \
        " El lote volvió a estar disponible."
    _mensaje_sistema(db, operacion_id, texto, remitente_id=usuario["user_id"] if lado == "equipo" else None)
    for lado_destino, cuenta in (("vendedor", op["cuenta_vendedor"]), ("comprador", op["cuenta_comprador"])):
        if lado_destino == lado:
            continue
        avisos.avisar(sql, cuenta=cuenta, tipo="liquidacion_cancelada", titulo="Reserva cancelada",
                      mensaje=f"«{op['lote']['nombre']}»: {texto}",
                      data={"operacion_id": operacion_id, "lado": lado_destino}, externo=True)
    return detalle_operacion(db, sql, usuario, operacion_id, vencer=False)


def adjuntar(db: Database, sql: Session, usuario: dict, operacion_id: str, archivo_id: str, tipo: str) -> Dict:
    op = _operacion_visible(db, usuario, operacion_id)
    lado = _lado(op, usuario)
    esperado = {"comprobante_pago": "comprador", "factura": "vendedor"}[tipo]
    if lado != esperado:
        quien = "El comprador sube el comprobante de pago" if tipo == "comprobante_pago" else "El vendedor sube la factura"
        raise _error(status.HTTP_403_FORBIDDEN, quien)
    if op["estado"] not in ("activa", "vendida"):
        raise _error(status.HTTP_409_CONFLICT, "Esta operación está cerrada")
    try:
        referencia = archivos.reclamar(db, ids=[archivo_id], tipo=tipo, cuenta=cuenta_de(usuario),
                                       operacion_id=operacion_id)[0]
    except archivos.ArchivoInvalido as exc:
        raise _error(status.HTTP_400_BAD_REQUEST, str(exc))
    referencia["subido_en"] = _iso(_ahora())
    campo = "comprobantes_pago" if tipo == "comprobante_pago" else "facturas"
    agregado = db.operaciones.update_one({"_id": operacion_id, f"{campo}.id": {"$ne": archivo_id}},
                                         {"$push": {campo: referencia}})
    if not agregado.modified_count:
        raise _error(status.HTTP_409_CONFLICT, "Ese documento ya está adjunto")

    info = archivos.ref_documento(referencia)
    activacion = obtener_activacion(db, cuenta_de(usuario)) or {}
    nombre = "el comprobante de pago" if tipo == "comprobante_pago" else "la factura"
    mensaje = {
        "_id": str(uuid4()),
        "operacion_id": operacion_id,
        "remitente_id": usuario["user_id"],
        "remitente_cuenta": cuenta_de(usuario),
        "remitente_nombre": activacion.get("contacto") or activacion.get("razon_social"),
        "tipo": "archivo",
        "contenido": f"Adjuntó {nombre}.",
        "archivo": info,
        "fecha": _ahora(),
    }
    db.mensajes.insert_one(mensaje)
    db.operaciones.update_one({"_id": operacion_id}, {"$set": {"ultimo_mensaje_en": mensaje["fecha"]},
                                                       "$inc": {"total_mensajes": 1}})
    otra = op["cuenta_vendedor"] if lado == "comprador" else op["cuenta_comprador"]
    avisos.avisar(sql, cuenta=otra, tipo=f"liquidacion_{tipo}",
                  titulo="Nuevo documento en una operación",
                  mensaje=f"«{op['lote']['nombre']}»: la otra parte adjuntó {nombre}.",
                  data={"operacion_id": operacion_id, "lado": _otro_lado(lado)})
    return detalle_operacion(db, sql, usuario, operacion_id)


# ==================== Monitoreo y cuentas (equipo) ====================

def operaciones_admin(db: Database, sql: Session, *, q: Optional[str], estado: Optional[str],
                      limite: int, desde: int) -> Dict:
    vencer_pendientes(db, sql)
    filtro: Dict[str, Any] = {}
    if estado in ("activa", "vendida", "cancelada", "vencida"):
        filtro["estado"] = estado
    q = (q or "").strip()[:80]
    if q:
        patron = {"$regex": re.escape(q), "$options": "i"}
        filtro["$or"] = [{"lote.nombre": patron}, {"vendedor.razon_social": patron},
                         {"comprador.razon_social": patron}, {"vendedor.nit": patron}, {"comprador.nit": patron}]
    total = db.operaciones.count_documents(filtro)
    filas = db.operaciones.find(filtro).sort("ultimo_mensaje_en", -1).skip(desde).limit(limite)
    return {"total": total, "operaciones": [a_operacion_resumen(op) for op in filas]}


def intervenir(db: Database, sql: Session, usuario: dict, operacion_id: str, contenido: str) -> Dict:
    op = db.operaciones.find_one({"_id": operacion_id})
    if not op:
        raise _error(status.HTTP_404_NOT_FOUND, "Operación no encontrada")
    _mensaje_sistema(db, operacion_id, f"[Soporte Zarpi] {contenido}", remitente_id=usuario["user_id"],
                     remitente_nombre="Soporte Zarpi")
    for lado_destino, cuenta in (("vendedor", op["cuenta_vendedor"]), ("comprador", op["cuenta_comprador"])):
        avisos.avisar(sql, cuenta=cuenta, tipo="liquidacion_soporte", titulo="Soporte Zarpi escribió en tu operación",
                      mensaje=f"«{op['lote']['nombre']}»: {contenido[:120]}",
                      data={"operacion_id": operacion_id, "lado": lado_destino})
    return detalle_operacion(db, sql, usuario, operacion_id, vencer=False)


def cuentas_admin(db: Database, *, q: Optional[str], limite: int, desde: int) -> Dict:
    filtro: Dict[str, Any] = {}
    q = (q or "").strip()[:80]
    if q:
        patron = {"$regex": re.escape(q), "$options": "i"}
        filtro["$or"] = [{"razon_social": patron}, {"nit": patron}, {"email": patron}, {"contacto": patron}]
    total = db.activaciones.count_documents(filtro)
    filas = list(db.activaciones.find(filtro).sort("declaracion_aceptada_en", -1).skip(desde).limit(limite))
    cuentas = [f["_id"] for f in filas]
    publicados = {r["_id"]: r["n"] for r in db.lotes.aggregate([
        {"$match": {"cuenta_vendedor": {"$in": cuentas}}}, {"$group": {"_id": "$cuenta_vendedor", "n": {"$sum": 1}}}])}
    compras = {r["_id"]: r["n"] for r in db.operaciones.aggregate([
        {"$match": {"cuenta_comprador": {"$in": cuentas}, "estado": "vendida"}},
        {"$group": {"_id": "$cuenta_comprador", "n": {"$sum": 1}}}])}
    salida = []
    for fila in filas:
        item = a_activacion(fila)
        item["lotes"] = publicados.get(fila["_id"], 0)
        item["compras"] = compras.get(fila["_id"], 0)
        salida.append(item)
    return {"total": total, "cuentas": salida}


def suspender(db: Database, sql: Session, usuario: dict, cuenta: str, suspendida: bool, motivo: Optional[str]) -> Dict:
    doc = db.activaciones.find_one_and_update(
        {"_id": cuenta},
        {"$set": {"suspendida": suspendida, "motivo_suspension": (motivo or "").strip() or None if suspendida else None,
                  "suspendida_por": usuario["user_id"] if suspendida else None, "actualizado_en": _ahora()}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise _error(status.HTTP_404_NOT_FOUND, "Cuenta no encontrada")
    avisos.avisar(sql, cuenta=cuenta, tipo="liquidacion_cuenta",
                  titulo="Tu cuenta de Liquidaciones fue suspendida" if suspendida else "Tu cuenta de Liquidaciones está activa de nuevo",
                  mensaje=(motivo or "") if suspendida else "Ya puedes volver a comprar y publicar lotes.",
                  externo=True)
    return a_activacion(doc)


def metricas(db: Database, sql: Optional[Session]) -> Dict:
    vencer_pendientes(db, sql)
    ahora = _ahora()
    desde = ahora - timedelta(days=30)
    vendidas = list(db.operaciones.find({"estado": "vendida", "cerrada_en": {"$gte": desde}}, {"lote.precio_cop": 1}))
    vencidas = db.operaciones.count_documents({"estado": "vencida", "cerrada_en": {"$gte": desde}})
    canceladas = db.operaciones.count_documents({"estado": "cancelada", "cerrada_en": {"$gte": desde}})
    cerradas = len(vendidas) + vencidas + canceladas

    revisados = db.lotes.find({"revisado_en": {"$gte": desde}, "enviado_en": {"$ne": None}},
                              {"revisado_en": 1, "enviado_en": 1}).limit(2000)
    horas = [(l["revisado_en"] - l["enviado_en"]).total_seconds() / 3600 for l in revisados
             if l.get("revisado_en") and l.get("enviado_en") and l["revisado_en"] >= l["enviado_en"]]
    return {
        "publicados": db.lotes.count_documents({"estado": "publicado"}),
        "en_revision": db.lotes.count_documents({"estado": "en_revision"}),
        "reservas_activas": db.operaciones.count_documents({"estado": "activa"}),
        "vendidos_30d": len(vendidas),
        "valor_vendido_30d_cop": sum(int((v.get("lote") or {}).get("precio_cop") or 0) for v in vendidas),
        "vencidas_30d": vencidas,
        "canceladas_30d": canceladas,
        "tasa_venta_30d": round(len(vendidas) / cerradas, 3) if cerradas else None,
        "horas_promedio_revision": round(sum(horas) / len(horas), 1) if horas else None,
        "cuentas_activadas": db.activaciones.count_documents({}),
        "cuentas_suspendidas": db.activaciones.count_documents({"suspendida": True}),
    }
