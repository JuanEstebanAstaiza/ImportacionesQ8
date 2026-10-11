"""Cargue y descargue de pagos: comprobantes manuales mientras llega la pasarela.

Ver models/comprobante.py. Los archivos se suben por gestión documental (la
subida normal) y aquí se registran, se mueven a «Pagos/…» y se revisan.
"""
from __future__ import annotations

import logging
from datetime import datetime
from html import escape
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import config
from models.comprobante import ComprobantePago, EstadoComprobante, TipoComprobante
from models.curso import Curso, OrigenAccesoCurso
from models.documental import Archivo
from models.tier import MovimientoPuntoCotizacion
from models.usuario import Usuario
from services import configuracion
from services.documental_service import ensure_folder_path

logger = logging.getLogger("importacionesq8")

CARPETAS = {
    TipoComprobante.tokens.value: ["Pagos", "Comprobantes de cotizaciones"],
    TipoComprobante.suscripcion.value: ["Pagos", "Suscripción Tendencias"],
    TipoComprobante.reto.value: ["Pagos", "Pagos del reto"],
    TipoComprobante.curso.value: ["Pagos", "Cursos"],
}
# Donde guarda el equipo los comprobantes que sube del reto (en su propia gestión documental).
CARPETA_EQUIPO_RETO = ["Pagos", "Reto pagados"]

CLAVE_PRECIO_TOKEN = "pagos.precio_token_cop"
CLAVE_DATOS_PAGO = "pagos.datos_pago"
TIPOS_ARCHIVO = ("imagen", "documento")


def concepto(tipo: str, cantidad: Optional[int] = None, curso: Optional[str] = None) -> str:
    """A qué pertenece el pago, para los correos («compra de cotizaciones…»).
    `curso`: el título, en los pagos de un curso."""
    if tipo == TipoComprobante.tokens.value:
        if cantidad:
            return f"la compra de cotizaciones ({cantidad} {'token' if cantidad == 1 else 'tokens'})"
        return "la compra de cotizaciones"
    if tipo == TipoComprobante.suscripcion.value:
        return "el pago de la suscripción a Tendencias"
    if tipo == TipoComprobante.curso.value:
        return f"el acceso al curso «{curso}»" if curso else "el acceso a un curso"
    return "la recompensa del reto"


def _titulo_curso(db: Session, curso_id: Optional[str]) -> Optional[str]:
    if not curso_id:
        return None
    return db.query(Curso.titulo).filter(Curso.id == curso_id).scalar()


def concepto_de(db: Session, c: ComprobantePago) -> str:
    return concepto(c.tipo, c.cantidad_solicitada, _titulo_curso(db, c.curso_id))


def acusar_recibo(db: Session, usuario_id: str, titulo: str, que: str, *, evento: str,
                  data: Optional[Dict] = None) -> None:
    """Correo automático desde pagos@ (y aviso en la campana) apenas llega un
    comprobante o una solicitud de retiro: todavía no está aprobado."""
    from services.notificacion_service import notificar

    notificar(
        db, usuario_id=usuario_id, tipo="pagos", titulo=titulo,
        mensaje=f"Hemos recibido tu {que}. Pronto nos pondremos en contacto contigo después de haber verificado la información.",
        data={"evento": evento, **(data or {})}, enlace_relativo="/pagos", whatsapp=False, email=True,
        buzon="pagos",
    )


def _error(codigo: int, mensaje: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=mensaje)


# ── Configuración ────────────────────────────────────────────────────────────

def precio_token(db: Session) -> Optional[int]:
    valor = configuracion.obtener(db, CLAVE_PRECIO_TOKEN)
    try:
        precio = int(float(valor)) if valor else None
    except (TypeError, ValueError):
        return None
    return precio if precio and precio > 0 else None


def datos_pago(db: Session) -> Optional[str]:
    return configuracion.obtener(db, CLAVE_DATOS_PAGO) or None


def guardar_config(db: Session, *, precio_token_cop: Optional[int], datos: Optional[str], usuario_id: str) -> None:
    configuracion.guardar(db, CLAVE_PRECIO_TOKEN, str(precio_token_cop) if precio_token_cop else None, usuario_id)
    configuracion.guardar(db, CLAVE_DATOS_PAGO, (datos or "").strip() or None, usuario_id)


# ── Serialización ────────────────────────────────────────────────────────────

def a_dict(db: Session, c: ComprobantePago, admin: bool = False) -> Dict:
    archivo = db.query(Archivo).filter(Archivo.id == c.archivo_id).first()
    datos = {
        "id": c.id,
        "tipo": c.tipo,
        "estado": c.estado,
        "archivo": {
            "id": c.archivo_id,
            "nombre": archivo.nombre if archivo else None,
            "tipo_recurso": archivo.tipo_recurso if archivo else None,
            "url": f"/documentos/archivos/{c.archivo_id}/descargar",
        },
        "cantidad_solicitada": c.cantidad_solicitada,
        "monto_cop": c.monto_cop,
        "nota": c.nota,
        "cantidad_acreditada": c.cantidad_acreditada,
        "motivo_rechazo": c.motivo_rechazo,
        "revisado_en": c.revisado_en.isoformat() + "Z" if c.revisado_en else None,
        "fecha": c.fecha_creacion.isoformat() + "Z",
        "curso": None,
    }
    if c.curso_id:
        curso = db.query(Curso).filter(Curso.id == c.curso_id).first()
        if curso is not None:
            datos["curso"] = {"id": curso.id, "titulo": curso.titulo, "precio": float(curso.precio or 0)}
    if admin:
        u = db.query(Usuario).filter(Usuario.id == c.usuario_id).first()
        datos["usuario"] = {
            "id": c.usuario_id,
            "email": u.email if u else None,
            "nombre": " ".join(x for x in ((u.nombre if u else None), (u.apellido if u else None)) if x) or None,
            "tokens": int(u.puntos_cotizacion or 0) if u else 0,
        }
    return datos


def puede_ver_archivo(db: Session, archivo_id: str, usuario_id: str, rol: str) -> bool:
    """El archivo de un comprobante lo ven quien pagó (o recibió el pago) y el admin."""
    consulta = db.query(ComprobantePago.id).filter(ComprobantePago.archivo_id == archivo_id)
    if rol != "admin":
        consulta = consulta.filter(ComprobantePago.usuario_id == usuario_id)
    return consulta.first() is not None


# ── Usuario: subir comprobante ───────────────────────────────────────────────

def _archivo_propio(db: Session, archivo_id: str, usuario_id: str) -> Archivo:
    archivo = db.query(Archivo).filter(Archivo.id == archivo_id, Archivo.deleted_at.is_(None)).first()
    if archivo is None or archivo.owner_user_id != usuario_id:
        raise _error(status.HTTP_404_NOT_FOUND, "Archivo no encontrado")
    if archivo.tipo_recurso not in TIPOS_ARCHIVO:
        raise _error(status.HTTP_400_BAD_REQUEST, "El comprobante debe ser una imagen o un PDF")
    if db.query(ComprobantePago.id).filter(ComprobantePago.archivo_id == archivo.id).first():
        raise _error(status.HTTP_409_CONFLICT, "Ese archivo ya se cargó como comprobante")
    return archivo


def _avisar_admins(db: Session, titulo: str, mensaje: str, data: Dict) -> None:
    from services.notificacion_service import notificar

    for admin in db.query(Usuario).filter(Usuario.rol == "admin", Usuario.activo.is_(True)).all():
        notificar(db, usuario_id=admin.id, tipo="pagos", titulo=titulo, mensaje=mensaje, data=data,
                  enlace_relativo="/admin/pagos", whatsapp=False, email=False)


def _curso_a_pagar(db: Session, usuario: Usuario, curso_id: Optional[str]) -> Curso:
    from services import acceso_cursos

    if not curso_id:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "Indica qué curso estás pagando")
    if not acceso_cursos.pago_manual_activo(db):
        raise _error(status.HTTP_409_CONFLICT, "Los cursos ya no se pagan con comprobante: cómpralo desde Cursos")
    curso = acceso_cursos.curso_pagable(db, curso_id)
    if float(curso.precio or 0) <= 0:
        raise _error(status.HTTP_409_CONFLICT, "Este curso es gratis: inscríbete desde Cursos")
    if acceso_cursos.tiene_acceso(db, usuario.id, curso.id):
        raise _error(status.HTTP_409_CONFLICT, "Ya tienes acceso a este curso")
    if acceso_cursos.comprobante_pendiente(db, usuario.id, curso.id):
        raise _error(status.HTTP_409_CONFLICT, "Ya enviaste el comprobante de este curso: lo estamos revisando")
    return curso


def crear(db: Session, usuario: Usuario, *, tipo: str, archivo_id: str, cantidad: Optional[int],
          monto_cop: Optional[int], nota: Optional[str], curso_id: Optional[str] = None) -> ComprobantePago:
    if tipo not in (TipoComprobante.tokens.value, TipoComprobante.suscripcion.value, TipoComprobante.curso.value):
        raise _error(status.HTTP_400_BAD_REQUEST, "Tipo de comprobante no válido")
    if tipo == TipoComprobante.suscripcion.value and usuario.rol != "solicitante":
        raise _error(status.HTTP_403_FORBIDDEN, "La suscripción a Tendencias es para cuentas de comprador")
    curso = None
    if tipo == TipoComprobante.curso.value:
        curso = _curso_a_pagar(db, usuario, curso_id)
        # El valor es el del curso; lo que escriba el usuario solo es referencia si no hay precio.
        monto_cop = int(round(float(curso.precio)))
        cantidad = None
    archivo = _archivo_propio(db, archivo_id, usuario.id)
    archivo.carpeta_id = ensure_folder_path(db, owner_user_id=usuario.id, segments=CARPETAS[tipo])
    comprobante = ComprobantePago(
        usuario_id=usuario.id, tipo=tipo, estado=EstadoComprobante.pendiente.value, archivo_id=archivo.id,
        subido_por=usuario.id, cantidad_solicitada=cantidad, monto_cop=monto_cop,
        nota=(nota or "").strip()[:500] or None, curso_id=curso.id if curso else None,
    )
    db.add(comprobante)
    db.flush()
    que = concepto(tipo, cantidad, curso.titulo if curso else None)
    _avisar_admins(db, "Comprobante de pago por revisar", f"{usuario.email} subió el comprobante de {que}.",
                   {"evento": "comprobante_nuevo", "comprobante_id": comprobante.id})
    acusar_recibo(db, usuario.id, "Recibimos tu comprobante de pago", f"comprobante de pago de {que}",
                  evento="comprobante_recibido", data={"comprobante_id": comprobante.id})
    copia_a_pagos(db, usuario, comprobante, archivo, que)
    return comprobante


# ── Copia a pagos@ ───────────────────────────────────────────────────────────

def _cop(valor: Optional[int]) -> str:
    return "No indicado" if valor is None else "$" + f"{int(valor):,}".replace(",", ".") + " COP"


def _adjunto_archivo(archivo: Archivo) -> Optional[tuple]:
    """El comprobante como adjunto, si está en el disco y no es muy grande."""
    from routers.documentos import _resolve_local_storage_path

    try:
        ruta = _resolve_local_storage_path(archivo)
        if ruta is None or ruta.stat().st_size > config.MAX_ADJUNTO_CORREO_BYTES:
            return None
        return (archivo.nombre, ruta.read_bytes(), archivo.mime_type or "application/octet-stream")
    except OSError:
        logger.exception("No se pudo leer el comprobante %s para adjuntarlo", archivo.id)
        return None


def copia_a_pagos(db: Session, usuario: Usuario, c: ComprobantePago, archivo: Archivo, que: str) -> bool:
    """A pagos@ le llega cada comprobante con el comprobante y el concepto
    adjuntos. «Responder» le escribe a quien pagó. Si el correo no sale, el
    comprobante igual queda para revisar en Admin › Pagos."""
    from services.pdf_document_service import _build_simple_pdf
    from utils.email import construir_html_zarpi, enviar_correo

    nombre = " ".join(x for x in (usuario.nombre, usuario.apellido) if x) or usuario.email
    fecha = (c.fecha_creacion or datetime.utcnow()).strftime("%d/%m/%Y %H:%M UTC")
    filas = [
        ("Concepto", que[0].upper() + que[1:]),
        ("Valor", _cop(c.monto_cop)),
        ("Usuario", f"{nombre} <{usuario.email}>"),
        ("Fecha", fecha),
        ("Comprobante", c.id),
    ]
    if c.cantidad_solicitada:
        filas.insert(2, ("Cantidad", str(c.cantidad_solicitada)))
    if c.nota:
        filas.append(("Nota del usuario", c.nota))

    adjuntos = []
    comprobante = _adjunto_archivo(archivo)
    if comprobante:
        adjuntos.append(comprobante)
    pdf = _build_simple_pdf(["Zarpi - Concepto de pago", ""] + [f"{k}: {v}" for k, v in filas], win_ansi=True)
    adjuntos.append((f"Concepto de pago {c.id[:8]}.pdf", pdf, "application/pdf"))

    revisar = f"{config.FRONTEND_URL}/admin/pagos"
    aviso_adjunto = "" if comprobante else (
        "El comprobante es muy grande para adjuntarlo: ábrelo desde Admin › Pagos.")
    asunto = f"Comprobante de pago — {que[0].upper() + que[1:]} — {usuario.email}"
    texto = ("Llegó un comprobante de pago para revisar.\n\n"
             + "".join(f"{k}: {v}\n" for k, v in filas)
             + (f"\n{aviso_adjunto}\n" if aviso_adjunto else "")
             + f"\nAprobarlo o rechazarlo: {revisar}\n")
    html = construir_html_zarpi(
        "Comprobante de pago por revisar",
        "<p>" + "<br/>".join(f"<strong>{escape(k)}:</strong> {escape(v)}" for k, v in filas) + "</p>"
        + (f"<p>{escape(aviso_adjunto)}</p>" if aviso_adjunto else "")
        + f'<p><a href="{escape(revisar, quote=True)}">Aprobarlo o rechazarlo en Admin › Pagos</a></p>',
    )
    try:
        enviado = enviar_correo(config.PAGOS_EMAIL, asunto, texto, html, responder_a=usuario.email,
                                adjuntos=adjuntos)
    except Exception:
        logger.exception("Fallo inesperado enviando la copia del comprobante %s a pagos@", c.id)
        enviado = False
    if not enviado:
        logger.error("No llegó a %s la copia del comprobante %s", config.PAGOS_EMAIL, c.id)
    return enviado


def mios(db: Session, usuario_id: str, tipo: Optional[str] = None) -> List[ComprobantePago]:
    consulta = db.query(ComprobantePago).filter(ComprobantePago.usuario_id == usuario_id)
    if tipo:
        consulta = consulta.filter(ComprobantePago.tipo == tipo)
    return consulta.order_by(ComprobantePago.fecha_creacion.desc()).limit(200).all()


# ── Admin: revisar ───────────────────────────────────────────────────────────

def _pendiente(db: Session, comprobante_id: str) -> ComprobantePago:
    c = db.query(ComprobantePago).filter(ComprobantePago.id == comprobante_id).first()
    if c is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Comprobante no encontrado")
    if c.estado != EstadoComprobante.pendiente.value:
        raise _error(status.HTTP_409_CONFLICT, "Este comprobante ya fue revisado")
    return c


def aprobar(db: Session, comprobante_id: str, admin: Usuario, cantidad: Optional[int]) -> ComprobantePago:
    """Acredita los tokens o los días de suscripción, o da el acceso al curso, y avisa al usuario."""
    from services.notificacion_service import notificar

    c = _pendiente(db, comprobante_id)
    if c.tipo == TipoComprobante.curso.value:
        from services import acceso_cursos

        curso = db.query(Curso).filter(Curso.id == c.curso_id).first()
        if curso is None:
            raise _error(status.HTTP_409_CONFLICT, "El curso de este comprobante ya no existe: recházalo")
        acceso_cursos.otorgar(db, usuario_id=c.usuario_id, curso=curso, origen=OrigenAccesoCurso.comprobante.value,
                              otorgado_por=admin.id, precio_pagado=c.monto_cop, comprobante_id=c.id)
        c.estado = EstadoComprobante.aprobado.value
        c.revisado_por = admin.id
        c.revisado_en = datetime.utcnow()
        acceso_cursos.avisar_acceso(db, c.usuario_id, curso, "comprobante_aprobado")
        return c
    if cantidad is None or cantidad < 1:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "Indica cuántos tokens o días acreditar")
    if c.tipo == TipoComprobante.tokens.value:
        db.query(Usuario).filter(Usuario.id == c.usuario_id).update(
            {Usuario.puntos_cotizacion: Usuario.puntos_cotizacion + cantidad}, synchronize_session=False)
        saldo = int(db.query(Usuario.puntos_cotizacion).filter(Usuario.id == c.usuario_id).scalar() or 0)
        db.add(MovimientoPuntoCotizacion(
            usuario_id=c.usuario_id, admin_id=admin.id, tipo="recarga", delta=cantidad, saldo_resultante=saldo,
            descripcion=f"Comprobante de pago {c.id[:8]}",
        ))
        titulo, mensaje = "Tokens acreditados", f"Aprobamos tu pago: te sumamos {cantidad} tokens de cotización. Tienes {saldo}."
    else:
        from models.tendencias import OrigenAcceso
        from services.tendencias import otorgar_acceso

        acceso = otorgar_acceso(db, usuario_id=c.usuario_id, dias=cantidad, origen=OrigenAcceso.pago.value,
                                otorgado_por=admin.id, nota=f"Comprobante de pago {c.id[:8]}")
        titulo = "Suscripción a Tendencias activa"
        mensaje = f"Aprobamos tu pago: tienes acceso a Tendencias hasta el {acceso.fin.strftime('%d/%m/%Y')}."
    c.estado = EstadoComprobante.aprobado.value
    c.cantidad_acreditada = cantidad
    c.revisado_por = admin.id
    c.revisado_en = datetime.utcnow()
    notificar(db, usuario_id=c.usuario_id, tipo="pagos", titulo=titulo, mensaje=mensaje,
              data={"evento": "comprobante_aprobado", "comprobante_id": c.id}, enlace_relativo="/pagos",
              whatsapp=False, email=True, buzon="pagos")
    return c


def rechazar(db: Session, comprobante_id: str, admin: Usuario, motivo: str) -> ComprobantePago:
    from services.notificacion_service import notificar

    c = _pendiente(db, comprobante_id)
    c.estado = EstadoComprobante.rechazado.value
    c.motivo_rechazo = motivo.strip()[:300]
    c.revisado_por = admin.id
    c.revisado_en = datetime.utcnow()
    notificar(db, usuario_id=c.usuario_id, tipo="pagos", titulo="No pudimos aprobar tu comprobante",
              mensaje=c.motivo_rechazo, data={"evento": "comprobante_rechazado", "comprobante_id": c.id},
              enlace_relativo="/pagos", whatsapp=False, email=True, buzon="pagos")
    return c


def para_admin(db: Session, *, estado: Optional[str] = None, tipo: Optional[str] = None) -> List[ComprobantePago]:
    consulta = db.query(ComprobantePago)
    if estado:
        consulta = consulta.filter(ComprobantePago.estado == estado)
    if tipo:
        consulta = consulta.filter(ComprobantePago.tipo == tipo)
    # Lo pendiente, primero lo más antiguo; el resto, lo más reciente primero.
    orden = ComprobantePago.fecha_creacion.asc() if estado == EstadoComprobante.pendiente.value \
        else ComprobantePago.fecha_creacion.desc()
    return consulta.order_by(orden).limit(300).all()


# ── Reto: comprobante del equipo ─────────────────────────────────────────────

def subir_reto(db: Session, admin: Usuario, participacion_id: str, archivo_id: str) -> ComprobantePago:
    """El comprobante de la transferencia de una recompensa en efectivo. El
    participante lo ve y lo descarga; no lo puede cambiar."""
    from models.reto import EleccionRecompensa, RetoParticipacion
    from services.notificacion_service import notificar

    participacion = db.query(RetoParticipacion).filter(RetoParticipacion.id == participacion_id).first()
    if participacion is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Participación no encontrada")
    if participacion.eleccion != EleccionRecompensa.efectivo.value:
        raise _error(status.HTTP_409_CONFLICT, "Solo las recompensas en efectivo llevan comprobante")
    archivo = _archivo_propio(db, archivo_id, admin.id)
    archivo.carpeta_id = ensure_folder_path(db, owner_user_id=admin.id, segments=CARPETA_EQUIPO_RETO)
    c = ComprobantePago(
        usuario_id=participacion.usuario_id, tipo=TipoComprobante.reto.value,
        estado=EstadoComprobante.enviado.value, archivo_id=archivo.id, subido_por=admin.id,
        monto_cop=participacion.monto_pagado_cop, participacion_id=participacion.id,
        revisado_por=admin.id, revisado_en=datetime.utcnow(),
    )
    db.add(c)
    db.flush()
    notificar(db, usuario_id=participacion.usuario_id, tipo="pagos", titulo="Comprobante de tu recompensa",
              mensaje="Ya puedes ver y descargar el comprobante de la transferencia en Pagos.",
              data={"evento": "comprobante_reto", "comprobante_id": c.id}, enlace_relativo="/pagos",
              whatsapp=False, email=True, buzon="pagos")
    return c
