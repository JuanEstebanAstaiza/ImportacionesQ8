"""Reglas de Tendencias v2: envío de enlaces, aprobación, feed y ficha.

Ver models/tendencias_virales.py y docs/Tendencias · Guía de construcción.html.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import String, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.cotizacion import Cotizacion
from models.documental import Archivo
from models.importador import Importador
from models.tendencias_virales import EstadoTendencia, MotivoRechazo, RolRemitente, TendenciaItem
from models.usuario import Usuario
from services import enlaces_video, reto
from services.tendencias import lunes_de, puede_curar, puede_disenar
from services.tendencias_calculo import bogota_a_utc, hoy_bogota

PIE_FICHA = "Zarpi conecta, no importa ni vende la mercancía."

MOTIVOS_RECHAZO = {
    MotivoRechazo.marca_replica.value: "Es una marca o una réplica",
    MotivoRechazo.repetido.value: "Ya lo tenemos publicado",
    MotivoRechazo.no_es_producto.value: "No muestra un producto para importar",
    MotivoRechazo.regulado_inviable.value: "Necesita un registro sanitario (INVIMA, ICA) que lo hace inviable",
    MotivoRechazo.calidad.value: "El video no deja ver bien el producto",
}

ETIQUETA_PLATAFORMA = {"tiktok": "TikTok", "instagram": "Instagram", "youtube": "YouTube"}

PATRON_ARCHIVO = re.compile(r"^/documentos/archivos/([0-9a-f-]{36})/descargar$")

MAX_IMAGENES = 8


def _error(codigo: int, mensaje: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=mensaje)


def rol_remitente(usuario: Usuario) -> str:
    if usuario.importador_id and usuario.rol in ("importador", "asesor"):
        return RolRemitente.importadora.value
    if usuario.rol in ("admin", "soporte", "designer") or usuario.es_curador:
        return RolRemitente.equipo.value
    return RolRemitente.comunidad.value


def validar_archivo_propio(db: Session, ruta: Optional[str], usuario: Usuario) -> Optional[str]:
    """Una portada es un archivo de gestión documental que subió quien la pone
    (o cualquiera, si quien la pone es del equipo aprobador)."""
    if not ruta:
        return None
    m = PATRON_ARCHIVO.match(ruta.strip())
    if not m:
        raise _error(status.HTTP_400_BAD_REQUEST, "La portada debe subirse a la plataforma")
    archivo = db.query(Archivo).filter(Archivo.id == m.group(1), Archivo.deleted_at.is_(None)).first()
    if archivo is None or archivo.tipo_recurso != "imagen":
        raise _error(status.HTTP_400_BAD_REQUEST, "La portada debe ser una imagen subida a la plataforma")
    if archivo.owner_user_id != usuario.id and not puede_curar(usuario):
        raise _error(status.HTTP_403_FORBIDDEN, "No puedes usar ese archivo como portada")
    return ruta.strip()


# ── Envío ────────────────────────────────────────────────────────────────────

def enviar(
    db: Session,
    usuario: Usuario,
    *,
    url: str,
    nombre: Optional[str] = None,
    categoria: Optional[str] = None,
    nota: Optional[str] = None,
    portada_url: Optional[str] = None,
) -> Dict:
    """Valida, normaliza y enriquece el enlace, y lo deja pendiente de revisión.

    Devuelve `{"estado": "recibido" | "duplicado", ...}`. Un enlace inválido
    levanta 422 con el motivo.
    """
    try:
        enlace = enlaces_video.normalizar(url)
    except enlaces_video.EnlaceInvalido as exc:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    existente = db.query(TendenciaItem).filter(TendenciaItem.url_normalizada == enlace.normalizada).first()
    if existente is not None:
        return _respuesta_duplicado(existente, usuario)

    try:
        enlace = enlaces_video.consultar_oembed(enlace)
    except enlaces_video.VideoNoDisponible:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ese video no existe o ya no está disponible.")

    rol = rol_remitente(usuario)
    portada = validar_archivo_propio(db, portada_url, usuario) if rol == RolRemitente.importadora.value else None
    participacion = reto.participacion_vigente(db, usuario.id) if rol == RolRemitente.comunidad.value else None

    item = TendenciaItem(
        url_origen=enlace.url_publica,
        url_normalizada=enlace.normalizada,
        plataforma=enlace.plataforma,
        id_video_plataforma=enlace.id_video,
        autor_plataforma=enlace.autor,
        miniatura_plataforma_url=enlace.miniatura_url,
        embed_html=enlace.embed_html,
        enviado_por=usuario.id,
        rol_remitente=rol,
        importador_id=usuario.importador_id if rol == RolRemitente.importadora.value else None,
        participacion_id=participacion.id if participacion else None,
        nota_remitente=(nota or "").strip()[:500] or None,
        nombre=(nombre or "").strip()[:120] or None,
        categoria=(categoria or "").strip()[:100] or None,
        portada_url=portada,
        estado=EstadoTendencia.pendiente.value,
    )
    db.add(item)
    if participacion is not None:
        participacion.ultimo_envio_en = datetime.utcnow()
    try:
        db.flush()
    except IntegrityError:
        # Otro envío del mismo video ganó la carrera.
        db.rollback()
        existente = db.query(TendenciaItem).filter(TendenciaItem.url_normalizada == enlace.normalizada).first()
        return _respuesta_duplicado(existente, usuario)

    from services.notificacion_service import notificar

    notificar(
        db, usuario_id=usuario.id, tipo="tendencias",
        titulo="Recibimos tu enlace",
        mensaje="Lo revisamos en menos de 48 horas.",
        data={"evento": "enlace_recibido", "tendencia_id": item.id},
        enlace_relativo="/tendencias/enviar", whatsapp=False, email=False,
    )
    db.commit()
    return {
        "estado": "recibido",
        "id": item.id,
        "plataforma": item.plataforma,
        "autor_plataforma": item.autor_plataforma,
        "reto": reto.resumen_participacion(db, participacion) if participacion else None,
    }


def _respuesta_duplicado(existente: Optional[TendenciaItem], usuario: Usuario) -> Dict:
    if existente is None:
        return {"estado": "duplicado", "mensaje": "Ese video ya está en Tendencias."}
    if existente.enviado_por == usuario.id:
        quien = "Ya lo habías subido tú."
    elif existente.rol_remitente == RolRemitente.equipo.value:
        quien = "Ya lo subió el equipo de Zarpi."
    elif existente.rol_remitente == RolRemitente.importadora.value:
        quien = "Ya lo recomendó una importadora."
    else:
        quien = "Ya lo subió otra persona."
    return {"estado": "duplicado", "mensaje": quien, "id": existente.id if existente.estado == EstadoTendencia.publicado.value else None}


# ── Aprobación ───────────────────────────────────────────────────────────────

def item_o_404(db: Session, item_id: str) -> TendenciaItem:
    item = db.query(TendenciaItem).filter(TendenciaItem.id == item_id).first()
    if item is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    return item


def editar(db: Session, item: TendenciaItem, usuario: Usuario, cambios: Dict) -> TendenciaItem:
    if "portada_url" in cambios:
        cambios["portada_url"] = validar_archivo_propio(db, cambios["portada_url"], usuario)
    if "embed_html" in cambios and cambios["embed_html"]:
        if item.plataforma != "instagram":
            raise _error(status.HTTP_400_BAD_REQUEST, "El código de inserción solo se pega para Instagram")
        codigo = enlaces_video.codigo_desde_embed_instagram(cambios["embed_html"])
        if codigo != item.id_video_plataforma:
            raise _error(status.HTTP_400_BAD_REQUEST, "El código de inserción no corresponde a esta publicación")
    for campo, valor in cambios.items():
        setattr(item, campo, valor.strip() if isinstance(valor, str) else valor)
    item.fecha_actualizacion = datetime.utcnow()
    return item


def aprobar(db: Session, item: TendenciaItem, usuario: Usuario, publicar: bool = False) -> TendenciaItem:
    """El aprobador decide si el producto entra (nombre, categoría, textos) y lo
    manda a diseño: un designer le pone la portada con la identidad de Zarpi y
    lo publica. `publicar` es el respaldo del admin cuando ya hay portada (por
    ejemplo, sin designers activos). La aprobación suma al reto del remitente."""
    if item.estado not in (EstadoTendencia.pendiente.value, EstadoTendencia.en_diseno.value):
        raise _error(status.HTTP_409_CONFLICT, "Este producto ya fue revisado")
    if not item.nombre or not item.categoria:
        raise _error(status.HTTP_400_BAD_REQUEST, "Ponle nombre y categoría antes de aprobar")
    if publicar:
        if usuario.rol != "admin":
            raise _error(status.HTTP_403_FORBIDDEN, "La portada la pone el equipo de diseño")
        if not item.portada_url:
            raise _error(status.HTTP_400_BAD_REQUEST, "Para publicar ya, sube la portada")
    elif item.estado == EstadoTendencia.en_diseno.value:
        raise _error(status.HTTP_409_CONFLICT, "Ya está en diseño")

    primera_vez = item.estado == EstadoTendencia.pendiente.value
    ahora = datetime.utcnow()
    item.aprobado_por = usuario.id
    if publicar:
        item.estado = EstadoTendencia.publicado.value
        item.publicado_en = ahora
        item.semana = lunes_de(hoy_bogota())
    else:
        item.estado = EstadoTendencia.en_diseno.value
    item.revisado_en = ahora

    if primera_vez:
        participacion = reto.participacion_por_id(db, item.participacion_id)
        if participacion is not None:
            reto.registrar_aprobado(db, participacion)
        _notificar_revision(db, item, aprobado=True, participacion=participacion)
    if item.estado == EstadoTendencia.en_diseno.value:
        _avisar_disenadores(db, item)
    return item


def _avisar_disenadores(db: Session, item: TendenciaItem) -> None:
    from services.notificacion_service import notificar

    for disenador in db.query(Usuario).filter(Usuario.rol == "designer", Usuario.activo.is_(True)).all():
        notificar(
            db, usuario_id=disenador.id, tipo="tendencias", titulo=f"Para diseñar: {item.nombre}",
            mensaje="Un producto aprobado espera su portada.",
            data={"evento": "para_disenar", "tendencia_id": item.id},
            enlace_relativo="/diseno", whatsapp=False, email=False,
        )


# ── Diseño ───────────────────────────────────────────────────────────────────

def imagenes_de(item: TendenciaItem) -> List[str]:
    try:
        valor = json.loads(item.imagenes) if item.imagenes else []
    except (TypeError, ValueError):
        return []
    return [r for r in valor if isinstance(r, str)][:MAX_IMAGENES] if isinstance(valor, list) else []


def _validar_imagen_diseno(db: Session, ruta: Optional[str], usuario: Usuario, item: TendenciaItem) -> Optional[str]:
    """Una imagen subida por el mismo designer, o una que el producto ya tenía
    (la foto que propuso la importadora)."""
    ruta = (ruta or "").strip()
    if not ruta:
        return None
    if ruta == item.portada_url or ruta in imagenes_de(item):
        return ruta
    m = PATRON_ARCHIVO.match(ruta)
    if not m:
        raise _error(status.HTTP_400_BAD_REQUEST, "Las imágenes deben subirse a la plataforma")
    archivo = db.query(Archivo).filter(Archivo.id == m.group(1), Archivo.deleted_at.is_(None)).first()
    if archivo is None or archivo.tipo_recurso != "imagen":
        raise _error(status.HTTP_400_BAD_REQUEST, "Debe ser una imagen subida a la plataforma")
    if archivo.owner_user_id != usuario.id:
        raise _error(status.HTTP_403_FORBIDDEN, "Solo puedes usar imágenes que subiste tú")
    return ruta


def cola_diseno(db: Session, limite: int = 100) -> List[TendenciaItem]:
    """Lo aprobado que espera portada, lo más antiguo primero."""
    return (
        db.query(TendenciaItem)
        .filter(TendenciaItem.estado == EstadoTendencia.en_diseno.value)
        .order_by(TendenciaItem.revisado_en.asc(), TendenciaItem.fecha_creacion.asc())
        .limit(limite).all()
    )


def disenar(db: Session, item: TendenciaItem, usuario: Usuario, cambios: Dict) -> TendenciaItem:
    """Guarda portada e imágenes. Vale en diseño y también ya publicado: así
    diseño corrige lo que salió sin la identidad de Zarpi (por ejemplo, lo que
    se publicó antes de existir el equipo de diseño). No publica."""
    if item.estado not in (EstadoTendencia.en_diseno.value, EstadoTendencia.publicado.value):
        raise _error(status.HTTP_409_CONFLICT, "Este producto no está en diseño")
    if "portada_url" in cambios:
        portada = _validar_imagen_diseno(db, cambios["portada_url"], usuario, item)
        if portada is None and item.estado == EstadoTendencia.publicado.value:
            raise _error(status.HTTP_400_BAD_REQUEST, "Un producto publicado no puede quedar sin portada")
        item.portada_url = portada
    if "imagenes" in cambios:
        rutas = [r for r in (cambios["imagenes"] or []) if isinstance(r, str) and r.strip()]
        if len(rutas) > MAX_IMAGENES:
            raise _error(status.HTTP_400_BAD_REQUEST, f"Máximo {MAX_IMAGENES} imágenes")
        validas = []
        for ruta in rutas:
            ruta = _validar_imagen_diseno(db, ruta, usuario, item)
            if ruta and ruta not in validas:
                validas.append(ruta)
        item.imagenes = json.dumps(validas) if validas else None
    item.fecha_actualizacion = datetime.utcnow()
    if item.estado == EstadoTendencia.publicado.value:
        # Retocar algo publicado lo deja con la identidad de Zarpi.
        marcar_disenado(item, usuario)
    return item


def marcar_disenado(item: TendenciaItem, usuario: Usuario) -> TendenciaItem:
    """Diseño revisó lo publicado y ya tiene la identidad de Zarpi."""
    if item.estado != EstadoTendencia.publicado.value:
        raise _error(status.HTTP_409_CONFLICT, "Solo se revisa un producto publicado")
    item.disenado_por = usuario.id
    item.disenado_en = datetime.utcnow()
    return item


def publicados_diseno(db: Session, usuario: Usuario, filtro: str = "todos", q: Optional[str] = None,
                      limite: int = 200) -> List[TendenciaItem]:
    """Lo publicado, para retocarlo. `sin_diseno`: lo que nadie de diseño ha
    revisado (primero lo más antiguo); `mios`: lo que diseñó quien pregunta."""
    consulta = db.query(TendenciaItem).filter(TendenciaItem.estado == EstadoTendencia.publicado.value)
    if filtro == "sin_diseno":
        consulta = consulta.filter(TendenciaItem.disenado_por.is_(None))
    elif filtro == "mios":
        consulta = consulta.filter(TendenciaItem.disenado_por == usuario.id)
    if q and q.strip():
        consulta = consulta.filter(TendenciaItem.nombre.ilike(f"%{q.strip()}%"))
    orden = TendenciaItem.publicado_en.asc() if filtro == "sin_diseno" else TendenciaItem.publicado_en.desc()
    return consulta.order_by(orden).limit(limite).all()


def publicar_diseno(db: Session, item: TendenciaItem, usuario: Usuario) -> TendenciaItem:
    from services.notificacion_service import notificar

    if item.estado != EstadoTendencia.en_diseno.value:
        raise _error(status.HTTP_409_CONFLICT, "Este producto no está en diseño")
    if not item.portada_url:
        raise _error(status.HTTP_400_BAD_REQUEST, "Sube la portada antes de publicar")
    ahora = datetime.utcnow()
    item.estado = EstadoTendencia.publicado.value
    item.publicado_en = ahora
    item.semana = lunes_de(hoy_bogota())
    item.disenado_por = usuario.id
    item.disenado_en = ahora
    notificar(
        db, usuario_id=item.enviado_por, tipo="tendencias", titulo=f"Publicado: {item.nombre}",
        mensaje="Ya está en Tendencias, con su portada.",
        data={"evento": "enlace_publicado", "tendencia_id": item.id},
        enlace_relativo=f"/tendencias/{item.id}", whatsapp=False, email=False,
    )
    return item


def para_disenador(db: Session, item: TendenciaItem) -> Dict:
    datos = para_aprobador(db, item)
    disenador = db.query(Usuario).filter(Usuario.id == item.disenado_por).first() if item.disenado_por else None
    datos.update({
        "revisado_en": item.revisado_en.isoformat() + "Z" if item.revisado_en else None,
        "disenado_en": item.disenado_en.isoformat() + "Z" if item.disenado_en else None,
        "disenado_por": (disenador.nombre or disenador.email) if disenador else None,
        # Publicado sin que diseño lo haya revisado: puede no tener la identidad de Zarpi.
        "con_identidad": bool(item.disenado_por),
    })
    return datos


def contadores_diseno(db: Session, usuario: Usuario) -> Dict:
    hoy = hoy_bogota()
    inicio = bogota_a_utc(datetime.combine(hoy, datetime.min.time()))
    return {
        "en_cola": db.query(func.count(TendenciaItem.id)).filter(
            TendenciaItem.estado == EstadoTendencia.en_diseno.value).scalar() or 0,
        "publicados_hoy": db.query(func.count(TendenciaItem.id)).filter(
            TendenciaItem.disenado_en >= inicio).scalar() or 0,
        "mios_total": db.query(func.count(TendenciaItem.id)).filter(
            TendenciaItem.disenado_por == usuario.id).scalar() or 0,
        "publicados_sin_diseno": db.query(func.count(TendenciaItem.id)).filter(
            TendenciaItem.estado == EstadoTendencia.publicado.value,
            TendenciaItem.disenado_por.is_(None)).scalar() or 0,
    }


def rechazar(db: Session, item: TendenciaItem, usuario: Usuario, motivo: str) -> TendenciaItem:
    if item.estado != EstadoTendencia.pendiente.value:
        raise _error(status.HTTP_409_CONFLICT, "Este producto ya fue revisado")
    if motivo not in MOTIVOS_RECHAZO:
        raise _error(status.HTTP_400_BAD_REQUEST, "Motivo de rechazo inválido")
    item.estado = EstadoTendencia.rechazado.value
    item.motivo_rechazo = motivo
    item.aprobado_por = usuario.id
    item.revisado_en = datetime.utcnow()
    _notificar_revision(db, item, aprobado=False, participacion=reto.participacion_por_id(db, item.participacion_id))
    return item


def _notificar_revision(db: Session, item: TendenciaItem, *, aprobado: bool, participacion) -> None:
    from services.notificacion_service import notificar

    progreso = ""
    if participacion is not None:
        ronda = reto.ronda_de(db, participacion)
        progreso = f" Llevás {participacion.aprobados} de {ronda.umbral_aprobados}."
    if aprobado:
        titulo = f"Aprobado: {item.nombre}"
        mensaje = ("Ya está publicado en Tendencias." if item.estado == EstadoTendencia.publicado.value
                   else "Lo aprobamos. Nuestro equipo de diseño le prepara la portada y se publica pronto.") + progreso
    else:
        titulo = "No aprobamos tu enlace"
        mensaje = f"{MOTIVOS_RECHAZO.get(item.motivo_rechazo, 'No cumple las reglas')}.{progreso}"
    notificar(
        db, usuario_id=item.enviado_por, tipo="tendencias", titulo=titulo, mensaje=mensaje,
        data={"evento": "enlace_aprobado" if aprobado else "enlace_rechazado", "tendencia_id": item.id},
        enlace_relativo=f"/tendencias/{item.id}" if item.estado == EstadoTendencia.publicado.value else "/tendencias/enviar",
        whatsapp=False, email=False,
    )


def cola(db: Session, estado: str = EstadoTendencia.pendiente.value, limite: int = 50) -> List[TendenciaItem]:
    return (
        db.query(TendenciaItem)
        .filter(TendenciaItem.estado == estado)
        .order_by(TendenciaItem.fecha_creacion.asc())
        .limit(limite)
        .all()
    )


def contadores(db: Session) -> Dict:
    hoy = hoy_bogota()
    inicio = bogota_a_utc(datetime.combine(hoy, datetime.min.time()))
    revisados_hoy = dict(
        db.query(TendenciaItem.estado, func.count(TendenciaItem.id))
        .filter(TendenciaItem.revisado_en >= inicio)
        .group_by(TendenciaItem.estado).all()
    )
    return {
        "pendientes": db.query(func.count(TendenciaItem.id)).filter(
            TendenciaItem.estado == EstadoTendencia.pendiente.value).scalar() or 0,
        "en_diseno": db.query(func.count(TendenciaItem.id)).filter(
            TendenciaItem.estado == EstadoTendencia.en_diseno.value).scalar() or 0,
        "aprobados_hoy": int(revisados_hoy.get(EstadoTendencia.publicado.value, 0)
                             + revisados_hoy.get(EstadoTendencia.en_diseno.value, 0)),
        "rechazados_hoy": int(revisados_hoy.get(EstadoTendencia.rechazado.value, 0)),
    }


# ── Serialización ────────────────────────────────────────────────────────────

def _empresas(db: Session, ids: Iterable[Optional[str]]) -> Dict[str, Importador]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {i.id: i for i in db.query(Importador).filter(Importador.id.in_(ids)).all()}


def _empresa_dict(empresa: Optional[Importador], completa: bool = False) -> Optional[Dict]:
    if empresa is None:
        return None
    datos = {
        "id": empresa.id,
        "nombre": empresa.nombre_empresa,
        "logo_url": empresa.logo_url,
        "verificado": bool(empresa.verificado),
    }
    if completa:
        datos.update({
            "calificacion_promedio": empresa.calificacion_promedio,
            "tiempo_respuesta_promedio": empresa.tiempo_respuesta_promedio,
            "especialidades": list(empresa.especialidad_producto or []),
            "paises_origen": list(empresa.paises_origen or []),
        })
    return datos


def inicio_semana_utc(semana: date) -> datetime:
    return bogota_a_utc(datetime.combine(semana, datetime.min.time()))


def _cotizaciones_semana(db: Session, ids: List[str]) -> Dict[str, int]:
    if not ids:
        return {}
    desde = inicio_semana_utc(lunes_de(hoy_bogota()))
    return dict(
        db.query(Cotizacion.tendencia_item_id, func.count(Cotizacion.id))
        .filter(Cotizacion.tendencia_item_id.in_(ids), Cotizacion.fecha_creacion >= desde)
        .group_by(Cotizacion.tendencia_item_id).all()
    )


def tarjeta(item: TendenciaItem, empresa: Optional[Importador], cotizaciones_semana: int) -> Dict:
    """Lo que necesita el feed. Sin código de inserción: el feed no carga
    ningún reproductor de terceros, solo la portada."""
    return {
        "id": item.id,
        "nombre": item.nombre,
        "categoria": item.categoria,
        "portada_url": item.portada_url,
        "plataforma": item.plataforma,
        "regulado": bool(item.regulado),
        "origen": item.rol_remitente,
        "empresa": _empresa_dict(empresa),
        "cotizaciones_semana": int(cotizaciones_semana),
        "cotizaciones_total": int(item.cotizaciones_count or 0),
        "semana": item.semana.isoformat() if item.semana else None,
        "publicado_en": item.publicado_en.isoformat() + "Z" if item.publicado_en else None,
    }


def ficha(db: Session, item: TendenciaItem) -> Dict:
    empresa = _empresas(db, [item.importador_id]).get(item.importador_id)
    datos = tarjeta(item, empresa, _cotizaciones_semana(db, [item.id]).get(item.id, 0))
    datos.update({
        "empresa": _empresa_dict(empresa, completa=True),
        "embed_url": enlaces_video.embed_url(item.plataforma, item.id_video_plataforma),
        "url_video": item.url_origen,
        "plataforma_nombre": ETIQUETA_PLATAFORMA.get(item.plataforma, item.plataforma),
        "autor_plataforma": item.autor_plataforma,
        "por_que_tendencia": item.por_que_tendencia,
        "ojo_antes": item.ojo_antes,
        "imagenes": imagenes_de(item),
        "pie": f"El video pertenece a su autor y se reproduce desde "
               f"{ETIQUETA_PLATAFORMA.get(item.plataforma, item.plataforma)}. {PIE_FICHA}",
    })
    return datos


def para_aprobador(db: Session, item: TendenciaItem) -> Dict:
    """La ficha completa más lo que solo ve el equipo: remitente, estado, nota."""
    remitente = db.query(Usuario).filter(Usuario.id == item.enviado_por).first()
    datos = ficha(db, item)
    participacion = reto.participacion_por_id(db, item.participacion_id)
    datos.update({
        "estado": item.estado,
        "motivo_rechazo": item.motivo_rechazo,
        "nota_remitente": item.nota_remitente,
        "miniatura_plataforma_url": item.miniatura_plataforma_url,
        "id_video_plataforma": item.id_video_plataforma,
        "tiene_embed_instagram": bool(item.embed_html) if item.plataforma == "instagram" else None,
        "fecha_envio": item.fecha_creacion.isoformat() + "Z",
        "remitente": {
            "id": remitente.id if remitente else None,
            "nombre": " ".join(x for x in (remitente.nombre, remitente.apellido) if x) if remitente else None,
            "email": remitente.email if remitente else None,
            "rol": item.rol_remitente,
            "en_reto": participacion is not None,
            "aprobados_reto": participacion.aprobados if participacion else None,
        },
    })
    return datos


def feed(db: Session, *, semana: Optional[date] = None, categoria: Optional[str] = None,
         importador_id: Optional[str] = None, limite: int = 60) -> Dict:
    semana = lunes_de(semana) if semana else lunes_de(hoy_bogota())
    consulta = db.query(TendenciaItem).filter(TendenciaItem.estado == EstadoTendencia.publicado.value)
    if importador_id:
        # Los "Recomendados" de una importadora: todos los publicados, no solo la semana.
        consulta = consulta.filter(TendenciaItem.importador_id == importador_id)
    else:
        consulta = consulta.filter(TendenciaItem.semana == semana)
    if categoria:
        consulta = consulta.filter(TendenciaItem.categoria == categoria)
    items = consulta.order_by(TendenciaItem.publicado_en.desc()).limit(limite).all()
    empresas = _empresas(db, (i.importador_id for i in items))
    semanales = _cotizaciones_semana(db, [i.id for i in items])
    return {
        "semana": semana.isoformat(),
        "semanas": semanas_con_publicaciones(db),
        "categorias": categorias_publicadas(db),
        "items": [tarjeta(i, empresas.get(i.importador_id), semanales.get(i.id, 0)) for i in items],
    }


def semanas_con_publicaciones(db: Session, limite: int = 26) -> List[str]:
    filas = (
        db.query(TendenciaItem.semana)
        .filter(TendenciaItem.estado == EstadoTendencia.publicado.value, TendenciaItem.semana.isnot(None))
        .distinct().order_by(TendenciaItem.semana.desc()).limit(limite).all()
    )
    return [f[0].isoformat() for f in filas]


def categorias_publicadas(db: Session) -> List[str]:
    filas = (
        db.query(TendenciaItem.categoria)
        .filter(TendenciaItem.estado == EstadoTendencia.publicado.value, TendenciaItem.categoria.isnot(None))
        .distinct().all()
    )
    return sorted(f[0] for f in filas)


# ── Acceso a archivos ────────────────────────────────────────────────────────

def _usa_archivo(archivo_id: str):
    patron = f"%/{archivo_id}/%"
    from sqlalchemy import or_

    return or_(
        func.cast(TendenciaItem.portada_url, String).like(patron),
        TendenciaItem.imagenes.like(patron),
    )


def es_portada_publica(db: Session, archivo_id: str) -> bool:
    """Portada e imágenes de un producto publicado: las ve cualquiera, con o sin sesión."""
    return db.query(TendenciaItem.id).filter(
        TendenciaItem.estado == EstadoTendencia.publicado.value,
        _usa_archivo(archivo_id),
    ).first() is not None


def es_portada_visible(db: Session, archivo_id: str, usuario: Optional[Usuario]) -> bool:
    """Portada o imágenes aún sin publicar (la foto que propuso una importadora,
    o lo que va subiendo diseño): las ven el equipo aprobador y diseño."""
    if usuario is None or not (puede_curar(usuario) or puede_disenar(usuario)):
        return False
    return db.query(TendenciaItem.id).filter(_usa_archivo(archivo_id)).first() is not None


# ── Tarea diaria ─────────────────────────────────────────────────────────────

def verificar_publicados(db: Session, ahora: Optional[datetime] = None, cliente=None) -> int:
    """Vuelve a consultar el oEmbed de lo publicado. Si la plataforma dice que
    el video ya no existe, la ficha pasa a «caído», sale del feed y se avisa a
    quien la aprobó. Instagram no tiene oEmbed automático en V1: se omite."""
    from services.notificacion_service import notificar

    ahora = ahora or datetime.utcnow()
    caidos = 0
    items = (
        db.query(TendenciaItem)
        .filter(TendenciaItem.estado == EstadoTendencia.publicado.value,
                TendenciaItem.plataforma.in_(("tiktok", "youtube")))
        .all()
    )
    for item in items:
        enlace = enlaces_video.Enlace(item.plataforma, item.id_video_plataforma or "", item.url_normalizada,
                                      item.url_origen)
        try:
            enlaces_video.consultar_oembed(enlace, cliente)
        except enlaces_video.VideoNoDisponible:
            item.estado = EstadoTendencia.caido.value
            caidos += 1
            if item.aprobado_por:
                notificar(
                    db, usuario_id=item.aprobado_por, tipo="tendencias",
                    titulo=f"Se cayó un video de Tendencias: {item.nombre}",
                    mensaje=f"{ETIQUETA_PLATAFORMA.get(item.plataforma, item.plataforma)} dice que el video ya no "
                            "está disponible. Salió del feed.",
                    data={"evento": "video_caido", "tendencia_id": item.id},
                    enlace_relativo="/tendencias/aprobacion", whatsapp=False, email=False,
                )
        item.ultima_verificacion = ahora
    db.commit()
    return caidos


def tarea_diaria(db: Session) -> Dict:
    return {
        "videos_caidos": verificar_publicados(db),
        "rondas_cerradas": reto.cerrar_vencidas(db),
        "avisos_inactividad": reto.avisar_inactivos(db),
    }
