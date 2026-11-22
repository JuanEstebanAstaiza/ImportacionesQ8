"""Reglas de negocio de Zarpi Maquilas (fase 1: cuentas, expediente y verificación).

Ciclo de una maquiladora:
- `registrada`: se creó la cuenta (registro público o el equipo desde Usuarios).
  Completa su perfil y su expediente (RUT, cámara de comercio...).
- `en_revision`: la envió a verificación; el equipo la revisa.
- `verificada`: aparece en el directorio y recibe solicitudes.
- `rechazada`: el equipo pidió cambios (con motivo); corrige y la reenvía.
- `suspendida`: el equipo la sacó del directorio (con motivo); puede reactivarla.

La cuenta del usuario vive en MySQL (login compartido) y la empresa en Mongo.
Como no hay transacción entre las dos bases, el alta crea primero el usuario y,
si Mongo falla, lo borra (compensación).
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from sqlalchemy.orm import Session

import config
from maquilas import archivos, avisos, parametros
from maquilas.esquemas import (
    AdminCrearMaquilaEntrada, DocumentosEntrada, EmpresaEntrada, FabricacionEntrada, PerfilEntrada,
    RegistroMaquilaEntrada, RepresentanteEntrada,
)
from maquilas.identidad import membresia, requerir_maquiladora_id
from models.otp import PropositoOtp
from models.usuario import Usuario
from schemas.auth import RegistroPendienteResponse
from utils.security import hash_password

logger = logging.getLogger("importacionesq8")

ESTADOS = ("registrada", "en_revision", "verificada", "rechazada", "suspendida")
# Mientras está en estos estados puede corregir los datos legales (razón social, NIT).
ESTADOS_EDITABLES_LEGALES = ("registrada", "rechazada")
ETIQUETAS_ESTADO = {
    "registrada": "Por completar",
    "en_revision": "En revisión",
    "verificada": "Verificada por Zarpi",
    "rechazada": "Requiere cambios",
    "suspendida": "Suspendida",
}


def _ahora() -> datetime:
    return datetime.utcnow()


def _iso(fecha: Optional[datetime]) -> Optional[str]:
    return fecha.isoformat() + "Z" if fecha else None


def _error(codigo: int, detalle: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=detalle)


def nit_normalizado(nit: str) -> str:
    return re.sub(r"[^0-9]", "", nit or "")


# ── Validación contra los parámetros ─────────────────────────────────────────

def _validar_fabricacion(db: Database, categorias: Optional[List[str]], procesos: Optional[List[str]]) -> None:
    p = parametros.leer(db)
    if categorias is not None:
        desconocidas = set(categorias) - {c["clave"] for c in p["categorias"]}
        if desconocidas:
            raise _error(status.HTTP_400_BAD_REQUEST, "Hay categorías que no existen: " + ", ".join(sorted(desconocidas)))
    if procesos is not None:
        desconocidos = set(procesos) - set(p["procesos"])
        if desconocidos:
            raise _error(status.HTTP_400_BAD_REQUEST, "Hay procesos que no existen: " + ", ".join(sorted(desconocidos)))


# ── Serialización ────────────────────────────────────────────────────────────

def a_maquiladora(doc: Dict, *, privado: bool = True) -> Dict[str, Any]:
    """`privado` incluye lo que solo ven la maquiladora y el equipo (documentos legales, contacto)."""
    salida = {
        "id": doc["_id"],
        "estado": doc["estado"],
        "estado_etiqueta": ETIQUETAS_ESTADO.get(doc["estado"], doc["estado"]),
        "razon_social": doc.get("razon_social"),
        "nombre_comercial": doc.get("nombre_comercial"),
        "ciudad": doc.get("ciudad"),
        "descripcion": doc.get("descripcion") or "",
        "categorias": doc.get("categorias") or [],
        "procesos": doc.get("procesos") or [],
        "certificaciones": doc.get("certificaciones") or [],
        "pedido_minimo": doc.get("pedido_minimo"),
        "capacidad_mensual": doc.get("capacidad_mensual"),
        "dias_muestra": doc.get("dias_muestra"),
        "dias_produccion": doc.get("dias_produccion"),
        "sitio_web": doc.get("sitio_web"),
        "galeria": [archivos.con_url(f) for f in doc.get("galeria") or []],
        "verificada_en": _iso(doc.get("verificada_en")),
    }
    if privado:
        documentos = doc.get("documentos") or {}
        salida.update({
            "nit": doc.get("nit"),
            "direccion": doc.get("direccion"),
            "telefono": doc.get("telefono"),
            "representante": doc.get("representante") or {},
            "documentos": {
                "rut": archivos.con_url(documentos.get("rut")),
                "camara_comercio": archivos.con_url(documentos.get("camara_comercio")),
                "certificados": [archivos.con_url(f) for f in documentos.get("certificados") or []],
            },
            "motivo": doc.get("motivo"),
            "enviada_en": _iso(doc.get("enviada_en")),
            "creado_en": _iso(doc.get("creado_en")),
            "creada_por_equipo": bool(doc.get("creado_por")),
            "pendientes": pendientes_para_verificar(doc),
        })
    return salida


def pendientes_para_verificar(doc: Dict) -> List[str]:
    """Lo que falta para poder enviarla a verificación (y para aprobarla)."""
    documentos = doc.get("documentos") or {}
    faltan = []
    if not documentos.get("rut"):
        faltan.append("Sube el RUT")
    if not documentos.get("camara_comercio"):
        faltan.append("Sube el certificado de cámara de comercio")
    if len((doc.get("descripcion") or "").strip()) < 30:
        faltan.append("Describe tu maquila (al menos 30 caracteres)")
    if not doc.get("categorias"):
        faltan.append("Elige al menos una categoría")
    if not doc.get("procesos"):
        faltan.append("Elige al menos un proceso")
    if not doc.get("galeria"):
        faltan.append("Sube al menos una foto de tus trabajos o tu planta")
    return faltan


# ── Alta de la cuenta ────────────────────────────────────────────────────────

def _crear_cuenta(
    db: Database,
    sql: Session,
    *,
    empresa: EmpresaEntrada,
    representante: RepresentanteEntrada,
    fabricacion: FabricacionEntrada,
    email_verificado: bool,
    acepto_politica: bool,
    creado_por: Optional[str],
) -> tuple:
    _validar_fabricacion(db, fabricacion.categorias, fabricacion.procesos)
    nit_norm = nit_normalizado(empresa.nit)
    if db.maquiladoras.count_documents({"nit_normalizado": nit_norm}, limit=1):
        raise _error(status.HTTP_409_CONFLICT, "Ya hay una maquiladora registrada con ese NIT")
    if sql.query(Usuario.id).filter(Usuario.email == representante.email).first():
        raise _error(status.HTTP_400_BAD_REQUEST, "No se pudo completar el registro con los datos proporcionados")

    ahora = _ahora()
    usuario = Usuario(
        id=str(uuid4()),
        email=representante.email,
        password_hash=hash_password(representante.password),
        rol="maquiladora",
        tipo_persona="juridica",
        tipo_documento=representante.tipo_documento,
        numero_documento=representante.numero_documento,
        nit=empresa.nit,
        razon_social=empresa.razon_social,
        nombre=representante.nombre,
        apellido=representante.apellido,
        indicativo_pais_telefono=representante.indicativo_pais_telefono,
        telefono=representante.telefono,
        acepto_politica_datos=acepto_politica,
        fecha_aceptacion_politica=ahora if acepto_politica else None,
        perfil_completo=True,
        email_verificado=email_verificado,
    )
    sql.add(usuario)
    sql.commit()

    maquiladora_id = str(uuid4())
    doc = {
        "_id": maquiladora_id,
        "estado": "registrada",
        "razon_social": empresa.razon_social.strip(),
        "nombre_comercial": empresa.nombre_comercial.strip(),
        "nit": empresa.nit,
        "nit_normalizado": nit_norm,
        "ciudad": empresa.ciudad.strip(),
        "direccion": (empresa.direccion or "").strip() or None,
        "telefono": (empresa.telefono or "").strip() or None,
        "sitio_web": (empresa.sitio_web or "").strip() or None,
        "descripcion": "",
        "categorias": fabricacion.categorias,
        "procesos": fabricacion.procesos,
        "certificaciones": [],
        "pedido_minimo": fabricacion.pedido_minimo,
        "capacidad_mensual": fabricacion.capacidad_mensual,
        "dias_muestra": fabricacion.dias_muestra,
        "dias_produccion": fabricacion.dias_produccion,
        "documentos": {"rut": None, "camara_comercio": None, "certificados": []},
        "galeria": [],
        "representante": {
            "nombre": representante.nombre, "apellido": representante.apellido,
            "tipo_documento": representante.tipo_documento, "numero_documento": representante.numero_documento,
            "email": representante.email,
            "telefono": f"{representante.indicativo_pais_telefono} {representante.telefono}",
        },
        "dueno_usuario_id": usuario.id,
        "creado_por": creado_por,
        "creado_en": ahora,
        "actualizado_en": ahora,
    }
    try:
        db.maquiladoras.insert_one(doc)
        db.miembros.insert_one({"_id": usuario.id, "maquiladora_id": maquiladora_id, "rol": "dueno", "creado_en": ahora})
    except Exception as exc:
        # Sin la empresa la cuenta no sirve para nada: se deshace el usuario.
        db.maquiladoras.delete_one({"_id": maquiladora_id})
        sql.delete(usuario)
        sql.commit()
        if isinstance(exc, DuplicateKeyError):
            raise _error(status.HTTP_409_CONFLICT, "Ya hay una maquiladora registrada con ese NIT")
        logger.exception("No se pudo crear la maquiladora en Mongo")
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "No pudimos crear la cuenta ahora. Intenta en unos minutos.")
    return usuario, doc


def registrar(db: Database, sql: Session, datos: RegistroMaquilaEntrada) -> RegistroPendienteResponse:
    """Registro público: la cuenta queda sin verificar hasta que confirme el código del correo."""
    from services import modulos
    from services.otp_service import emitir_otp

    if not modulos.activo(sql, "registro"):
        raise _error(status.HTTP_403_FORBIDDEN,
                     f"El registro está cerrado por ahora. Escríbenos a {config.CONTACT_EMAIL} y te creamos la cuenta.")
    auto = bool(config.LOAD_TEST_AUTO_VERIFY)
    usuario, _ = _crear_cuenta(db, sql, empresa=datos.empresa, representante=datos.representante,
                               fabricacion=datos.fabricacion, email_verificado=auto,
                               acepto_politica=datos.acepto_politica_datos, creado_por=None)
    enviado = True if auto else emitir_otp(sql, usuario, PropositoOtp.verificacion_email.value).enviado
    avisos.avisar(sql, avisos.usuarios_del_equipo(sql), tipo="maquila_registrada",
                  titulo="Nueva maquiladora registrada",
                  mensaje=f"{datos.empresa.nombre_comercial} creó su cuenta en Zarpi Maquilas.",
                  data={"evento": "maquila_registrada"})
    if not enviado:
        return RegistroPendienteResponse(
            user_id=str(usuario.id), email=usuario.email, correo_enviado=False,
            mensaje="Creamos tu cuenta, pero no pudimos enviarte el código. Pide uno nuevo en unos minutos.")
    return RegistroPendienteResponse(user_id=str(usuario.id), email=usuario.email)


def crear_por_equipo(db: Database, sql: Session, admin: dict, datos: AdminCrearMaquilaEntrada) -> Dict:
    """Alta desde Admin › Usuarios: la cuenta entra con el correo verificado y
    después la maquiladora completa su expediente como cualquier otra."""
    _, doc = _crear_cuenta(db, sql, empresa=datos.empresa, representante=datos.representante,
                           fabricacion=datos.fabricacion, email_verificado=True, acepto_politica=False,
                           creado_por=admin["user_id"])
    return a_maquiladora(doc)


# ── La maquiladora y su perfil ───────────────────────────────────────────────

def _maquiladora(db: Database, maquiladora_id: str) -> Dict:
    doc = db.maquiladoras.find_one({"_id": maquiladora_id})
    if not doc:
        raise _error(status.HTTP_404_NOT_FOUND, "Maquiladora no encontrada")
    return doc


def mi_maquiladora(db: Database, usuario: dict) -> Dict:
    doc = _maquiladora(db, requerir_maquiladora_id(db, usuario))
    fila = membresia(db, usuario) or {}
    return {**a_maquiladora(doc), "mi_rol": fila.get("rol", "colaborador")}


def _requerir_dueno(db: Database, usuario: dict) -> str:
    fila = membresia(db, usuario)
    if not fila:
        raise _error(status.HTTP_404_NOT_FOUND, "Tu cuenta no está vinculada a ninguna maquiladora")
    if fila.get("rol") != "dueno":
        raise _error(status.HTTP_403_FORBIDDEN, "Solo la cuenta dueña edita el perfil de la maquiladora")
    return fila["maquiladora_id"]


def actualizar_perfil(db: Database, usuario: dict, datos: PerfilEntrada) -> Dict:
    maquiladora_id = _requerir_dueno(db, usuario)
    doc = _maquiladora(db, maquiladora_id)
    cambios = datos.model_dump(exclude_none=True)
    if not cambios:
        return a_maquiladora(doc)
    legales = {k for k in ("razon_social", "nit") if k in cambios}
    if legales and doc["estado"] not in ESTADOS_EDITABLES_LEGALES:
        raise _error(status.HTTP_409_CONFLICT,
                     "La razón social y el NIT ya fueron verificados. Escríbenos por soporte para cambiarlos.")
    _validar_fabricacion(db, cambios.get("categorias"), cambios.get("procesos"))
    if "nit" in cambios:
        nit_norm = nit_normalizado(cambios["nit"])
        if db.maquiladoras.count_documents({"nit_normalizado": nit_norm, "_id": {"$ne": maquiladora_id}}, limit=1):
            raise _error(status.HTTP_409_CONFLICT, "Ya hay una maquiladora registrada con ese NIT")
        cambios["nit_normalizado"] = nit_norm
    for campo in ("razon_social", "nombre_comercial", "ciudad", "direccion", "telefono", "sitio_web", "descripcion"):
        if campo in cambios and isinstance(cambios[campo], str):
            cambios[campo] = cambios[campo].strip()
    cambios["actualizado_en"] = _ahora()
    db.maquiladoras.update_one({"_id": maquiladora_id}, {"$set": cambios})
    return a_maquiladora(_maquiladora(db, maquiladora_id))


def actualizar_documentos(db: Database, usuario: dict, datos: DocumentosEntrada) -> Dict:
    maquiladora_id = _requerir_dueno(db, usuario)
    doc = _maquiladora(db, maquiladora_id)
    p = parametros.leer(db)
    cuenta = f"maquiladora:{maquiladora_id}"
    cambios: Dict[str, Any] = {}
    reemplazados: List[Dict] = []
    documentos = doc.get("documentos") or {}

    for campo in ("rut", "camara_comercio"):
        nuevo = getattr(datos, campo)
        if nuevo is not None and (documentos.get(campo) or {}).get("id") != nuevo:
            cambios[f"documentos.{campo}"] = archivos.ligar(db, ids=[nuevo], tipo=campo, cuenta=cuenta)[0]
            if documentos.get(campo):
                reemplazados.append(documentos[campo])
    if datos.certificados is not None:
        if len(datos.certificados) > p["certificados_max"]:
            raise _error(status.HTTP_400_BAD_REQUEST, f"Sube como máximo {p['certificados_max']} certificados")
        actuales = {f["id"]: f for f in documentos.get("certificados") or []}
        nuevos = [i for i in datos.certificados if i not in actuales]
        ligados = {f["id"]: f for f in archivos.ligar(db, ids=nuevos, tipo="certificado", cuenta=cuenta)}
        cambios["documentos.certificados"] = [actuales.get(i) or ligados[i] for i in datos.certificados]
        reemplazados += [f for i, f in actuales.items() if i not in datos.certificados]
    if datos.galeria is not None:
        if len(datos.galeria) > p["fotos_galeria_max"]:
            raise _error(status.HTTP_400_BAD_REQUEST, f"La galería admite como máximo {p['fotos_galeria_max']} fotos")
        actuales = {f["id"]: f for f in doc.get("galeria") or []}
        nuevos = [i for i in datos.galeria if i not in actuales]
        ligados = {f["id"]: f for f in archivos.ligar(db, ids=nuevos, tipo="foto", cuenta=cuenta)}
        cambios["galeria"] = [actuales.get(i) or ligados[i] for i in datos.galeria]
        reemplazados += [f for i, f in actuales.items() if i not in datos.galeria]

    if cambios:
        cambios["actualizado_en"] = _ahora()
        db.maquiladoras.update_one({"_id": maquiladora_id}, {"$set": cambios})
        # Lo que se quitó o reemplazó ya no lo usa nadie.
        for ref in reemplazados:
            archivos.borrar(db, ref.get("bucket") or archivos.TIPOS["rut"][0], [ref["id"]])
    return a_maquiladora(_maquiladora(db, maquiladora_id))


def enviar_a_verificacion(db: Database, sql: Session, usuario: dict) -> Dict:
    maquiladora_id = _requerir_dueno(db, usuario)
    doc = _maquiladora(db, maquiladora_id)
    if doc["estado"] not in ("registrada", "rechazada"):
        raise _error(status.HTTP_409_CONFLICT, "Tu maquiladora ya está en revisión o verificada")
    faltan = pendientes_para_verificar(doc)
    if faltan:
        raise _error(status.HTTP_400_BAD_REQUEST, "Antes de enviarla: " + "; ".join(faltan))
    db.maquiladoras.update_one({"_id": maquiladora_id, "estado": doc["estado"]},
                               {"$set": {"estado": "en_revision", "enviada_en": _ahora(), "motivo": None}})
    avisos.avisar(sql, avisos.usuarios_del_equipo(sql, ("admin", "soporte")), tipo="maquila_en_revision",
                  titulo="Maquiladora por verificar",
                  mensaje=f"{doc['nombre_comercial']} envió su expediente para verificación.",
                  data={"evento": "maquila_en_revision", "maquiladora_id": maquiladora_id})
    return a_maquiladora(_maquiladora(db, maquiladora_id))


# ── Equipo: verificación ─────────────────────────────────────────────────────

def listar_para_equipo(db: Database, *, estado: Optional[str] = None, q: Optional[str] = None) -> Dict:
    filtro: Dict[str, Any] = {}
    if estado:
        if estado not in ESTADOS:
            raise _error(status.HTTP_400_BAD_REQUEST, "Estado desconocido")
        filtro["estado"] = estado
    if q and q.strip():
        patron = {"$regex": re.escape(q.strip()[:80]), "$options": "i"}
        filtro["$or"] = [{"razon_social": patron}, {"nombre_comercial": patron}, {"nit": patron}, {"ciudad": patron}]
    # Las que esperan revisión primero, y entre ellas las más antiguas.
    filas = list(db.maquiladoras.find(filtro).sort([("enviada_en", 1), ("creado_en", -1)]).limit(500))
    filas.sort(key=lambda d: (d["estado"] != "en_revision",))
    contadores = {e: db.maquiladoras.count_documents({"estado": e}) for e in ESTADOS}
    return {"maquiladoras": [a_maquiladora(d) for d in filas], "contadores": contadores}


def detalle_para_equipo(db: Database, maquiladora_id: str) -> Dict:
    doc = _maquiladora(db, maquiladora_id)
    miembros = list(db.miembros.find({"maquiladora_id": maquiladora_id}))
    return {**a_maquiladora(doc), "miembros": [{"usuario_id": m["_id"], "rol": m.get("rol")} for m in miembros]}


def _avisar_dueno(db: Database, sql: Session, doc: Dict, *, tipo: str, titulo: str, mensaje: str) -> None:
    avisos.avisar(sql, avisos.usuarios_de_maquiladora(db, doc["_id"]), tipo=tipo, titulo=titulo, mensaje=mensaje,
                  data={"evento": tipo, "maquiladora_id": doc["_id"]}, enlace="/maquilas/perfil", correo=True)


def aprobar(db: Database, sql: Session, equipo: dict, maquiladora_id: str) -> Dict:
    doc = _maquiladora(db, maquiladora_id)
    if doc["estado"] != "en_revision":
        raise _error(status.HTTP_409_CONFLICT, "Solo se aprueba una maquiladora que está en revisión")
    faltan = pendientes_para_verificar(doc)
    if faltan:
        raise _error(status.HTTP_400_BAD_REQUEST, "Al expediente le falta: " + "; ".join(faltan))
    db.maquiladoras.update_one({"_id": maquiladora_id}, {"$set": {
        "estado": "verificada", "verificada_en": _ahora(), "verificada_por": equipo["user_id"], "motivo": None}})
    _avisar_dueno(db, sql, doc, tipo="maquila_verificada", titulo="Tu maquiladora está verificada",
                  mensaje=f"{doc['nombre_comercial']} ya aparece en Zarpi Maquilas con el sello «Verificada por Zarpi».")
    return a_maquiladora(_maquiladora(db, maquiladora_id))


def rechazar(db: Database, sql: Session, equipo: dict, maquiladora_id: str, motivo: str) -> Dict:
    doc = _maquiladora(db, maquiladora_id)
    if doc["estado"] != "en_revision":
        raise _error(status.HTTP_409_CONFLICT, "Solo se rechaza una maquiladora que está en revisión")
    db.maquiladoras.update_one({"_id": maquiladora_id}, {"$set": {
        "estado": "rechazada", "motivo": motivo.strip(), "revisada_por": equipo["user_id"], "revisada_en": _ahora()}})
    _avisar_dueno(db, sql, doc, tipo="maquila_rechazada", titulo="Tu expediente necesita cambios",
                  mensaje=f"Revisamos {doc['nombre_comercial']}: {motivo.strip()}")
    return a_maquiladora(_maquiladora(db, maquiladora_id))


def suspender(db: Database, sql: Session, equipo: dict, maquiladora_id: str, motivo: str) -> Dict:
    doc = _maquiladora(db, maquiladora_id)
    if doc["estado"] == "suspendida":
        raise _error(status.HTTP_409_CONFLICT, "La maquiladora ya está suspendida")
    db.maquiladoras.update_one({"_id": maquiladora_id}, {"$set": {
        "estado": "suspendida", "estado_previo": doc["estado"], "motivo": motivo.strip(),
        "suspendida_por": equipo["user_id"], "suspendida_en": _ahora()}})
    _avisar_dueno(db, sql, doc, tipo="maquila_suspendida", titulo="Tu maquiladora fue suspendida",
                  mensaje=f"{doc['nombre_comercial']} salió del directorio: {motivo.strip()}")
    return a_maquiladora(_maquiladora(db, maquiladora_id))


def reactivar(db: Database, sql: Session, equipo: dict, maquiladora_id: str) -> Dict:
    doc = _maquiladora(db, maquiladora_id)
    if doc["estado"] != "suspendida":
        raise _error(status.HTTP_409_CONFLICT, "La maquiladora no está suspendida")
    # Vuelve a donde estaba (verificada, o a completar si se suspendió antes de verificarse).
    previo = doc.get("estado_previo") if doc.get("estado_previo") in ESTADOS[:4] else "registrada"
    db.maquiladoras.update_one({"_id": maquiladora_id}, {"$set": {"estado": previo, "motivo": None}})
    _avisar_dueno(db, sql, doc, tipo="maquila_reactivada", titulo="Tu maquiladora fue reactivada",
                  mensaje=f"{doc['nombre_comercial']} vuelve a estar activa en Zarpi Maquilas.")
    return a_maquiladora(_maquiladora(db, maquiladora_id))
