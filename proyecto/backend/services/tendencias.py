"""Reglas de negocio de Tendencias: acceso, cálculo por producto, publicación.

El cálculo de fechas está en services/tendencias_calculo.py (puro). Aquí va lo
que necesita la base de datos.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Optional

from sqlalchemy import String, func
from sqlalchemy.orm import Session

from models.tendencias import (
    AccesoTendencias, CambioTendencias, CierreFabricas, EdicionProducto, EdicionTendencias,
    EstadoEdicion, GuardadoTendencia, OrigenAcceso, ProductoTendencia, SuscripcionAvisoTendencias,
    Temporada,
)
from models.usuario import Usuario
from services import configuracion
from services.tendencias_calculo import (
    Cierre, FechasProducto, Parametros, calcular_fechas, estado_producto, fecha_larga, hoy_bogota,
)

logger = logging.getLogger("importacionesq8")

MAX_PRODUCTOS_POR_EDICION = 6
MAX_FOTOS_POR_PRODUCTO = 5
MAX_ANGULOS = 3

PIE_INFORMATIVO = (
    "Selección informativa del equipo de Zarpi. Las fechas son estimados; el tiempo "
    "real lo da cada nacionalizadora en su propuesta. No es una recomendación de "
    "inversión ni garantiza ventas."
)

CLAVE_DIAS_MAR = "tendencias.dias_mar"
CLAVE_DIAS_AEREO = "tendencias.dias_aereo"
CLAVE_DIAS_PRODUCCION = "tendencias.dias_produccion"
# Precio en pesos de un periodo de suscripción. Sin precio, no se vende: el
# acceso solo se puede regalar desde el panel.
CLAVE_PRECIO_COP = "tendencias.precio_cop"
CLAVE_DIAS_SUSCRIPCION = "tendencias.dias_suscripcion"
DIAS_SUSCRIPCION_DEFECTO = 30

CONCEPTO_PAGO_SUSCRIPCION = "suscripcion_tendencias"


# ── Parámetros ───────────────────────────────────────────────────────────────

def _entero(db: Session, clave: str, defecto: int) -> int:
    try:
        return int(configuracion.obtener(db, clave, str(defecto)))
    except (TypeError, ValueError):
        return defecto


def parametros(db: Session) -> Parametros:
    return Parametros(
        dias_mar=_entero(db, CLAVE_DIAS_MAR, Parametros.dias_mar),
        dias_aereo=_entero(db, CLAVE_DIAS_AEREO, Parametros.dias_aereo),
        dias_produccion=_entero(db, CLAVE_DIAS_PRODUCCION, Parametros.dias_produccion),
    )


def cierres(db: Session) -> List[Cierre]:
    return [
        Cierre(inicio=c.inicio, fin=c.fin, fin_produccion_previa=c.fin_produccion_previa)
        for c in db.query(CierreFabricas).order_by(CierreFabricas.inicio).all()
    ]


def precio_suscripcion(db: Session) -> Optional[int]:
    valor = configuracion.obtener(db, CLAVE_PRECIO_COP)
    try:
        precio = int(float(valor)) if valor is not None else None
    except (TypeError, ValueError):
        return None
    return precio if precio and precio > 0 else None


def dias_suscripcion(db: Session) -> int:
    return max(1, _entero(db, CLAVE_DIAS_SUSCRIPCION, DIAS_SUSCRIPCION_DEFECTO))


# ── Acceso ───────────────────────────────────────────────────────────────────

def puede_curar(usuario: Optional[Usuario]) -> bool:
    return bool(usuario and usuario.activo and (usuario.rol == "admin" or usuario.es_curador))


def _accesos_vigentes(db: Session, usuario_id: str, ahora: datetime):
    return db.query(AccesoTendencias).filter(
        AccesoTendencias.usuario_id == usuario_id,
        AccesoTendencias.revocado_en.is_(None),
        AccesoTendencias.inicio <= ahora,
        AccesoTendencias.fin > ahora,
    )


def acceso_vigente(db: Session, usuario_id: str, ahora: Optional[datetime] = None) -> Optional[AccesoTendencias]:
    """El periodo vigente que termina más tarde, o None."""
    ahora = ahora or datetime.utcnow()
    return _accesos_vigentes(db, usuario_id, ahora).order_by(AccesoTendencias.fin.desc()).first()


def acceso_hasta(db: Session, usuario_id: str, ahora: Optional[datetime] = None) -> Optional[datetime]:
    """Hasta cuándo tiene acceso, contando periodos ya comprados que empiezan
    después del actual (una renovación anticipada)."""
    ahora = ahora or datetime.utcnow()
    return (
        db.query(func.max(AccesoTendencias.fin))
        .filter(
            AccesoTendencias.usuario_id == usuario_id,
            AccesoTendencias.revocado_en.is_(None),
            AccesoTendencias.fin > ahora,
        )
        .scalar()
    )


def tiene_acceso(db: Session, usuario: Optional[Usuario]) -> bool:
    if usuario is None:
        return False
    if puede_curar(usuario):
        return True
    return acceso_vigente(db, usuario.id) is not None


def otorgar_acceso(
    db: Session,
    *,
    usuario_id: str,
    dias: int,
    origen: str,
    pago_id: Optional[str] = None,
    otorgado_por: Optional[str] = None,
    nota: Optional[str] = None,
    ahora: Optional[datetime] = None,
) -> AccesoTendencias:
    """Agrega un periodo de `dias`. Si el usuario ya tiene acceso, el periodo
    nuevo empieza cuando termina el último: renovar antes de tiempo no hace
    perder días."""
    ahora = ahora or datetime.utcnow()
    inicio = max(ahora, acceso_hasta(db, usuario_id, ahora) or ahora)
    acceso = AccesoTendencias(
        usuario_id=usuario_id,
        origen=origen,
        inicio=inicio,
        fin=inicio + timedelta(days=dias),
        pago_id=pago_id,
        otorgado_por=otorgado_por,
        nota=nota,
    )
    db.add(acceso)
    return acceso


def activar_suscripcion_pagada(db: Session, pago) -> AccesoTendencias:
    """Lo llama el webhook al confirmar un pago de suscripción. El pago ya
    pasó de pendiente a confirmado en esta misma transacción."""
    return otorgar_acceso(
        db,
        usuario_id=str(pago.usuario_id),
        dias=int(pago.dias_acceso or DIAS_SUSCRIPCION_DEFECTO),
        origen=OrigenAcceso.pago.value,
        pago_id=str(pago.id),
    )


def revocar_por_reembolso(db: Session, pago) -> None:
    ahora = datetime.utcnow()
    db.query(AccesoTendencias).filter(
        AccesoTendencias.pago_id == str(pago.id),
        AccesoTendencias.revocado_en.is_(None),
    ).update({AccesoTendencias.revocado_en: ahora}, synchronize_session=False)


# ── Serialización de productos ───────────────────────────────────────────────

def _fecha_iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def fechas_de(producto: ProductoTendencia, temporada: Optional[Temporada], params: Parametros,
              lista_cierres: Iterable[Cierre]) -> FechasProducto:
    return calcular_fechas(
        fecha_en_bodega_explicita=producto.fecha_en_bodega,
        fecha_temporada=temporada.fecha if temporada else None,
        parametros=params,
        cierres=list(lista_cierres),
        dias_mar=producto.dias_mar,
        dias_aereo=producto.dias_aereo,
    )


def texto_limite(fechas: FechasProducto, modo: str) -> Optional[str]:
    limite = fechas.mar if modo == "mar" else fechas.aereo
    if limite is None:
        return None
    medio = "por mar" if modo == "mar" else "aéreo"
    return (
        f"Pídelo antes del {fecha_larga(limite.fecha)} "
        f"(estimado con {limite.dias_puerta_a_puerta} días {medio})"
    )


def serializar_fechas(fechas: FechasProducto, hoy: date) -> Dict:
    estado = estado_producto(fechas, hoy)

    def _limite(limite):
        if limite is None:
            return None
        return {
            "fecha": limite.fecha.isoformat(),
            "dias_puerta_a_puerta": limite.dias_puerta_a_puerta,
            "aviso_cierre_fabricas": limite.aviso_cierre_fabricas,
        }

    return {
        "fecha_en_bodega": _fecha_iso(fechas.fecha_en_bodega),
        "limite_mar": _limite(fechas.mar),
        "limite_aereo": _limite(fechas.aereo),
        "texto_mar": texto_limite(fechas, "mar"),
        "texto_aereo": texto_limite(fechas, "aereo"),
        "estado": estado.codigo,
        "estado_texto": estado.texto,
        "dias_restantes": estado.dias_restantes,
    }


def serializar_producto(
    producto: ProductoTendencia,
    *,
    temporada: Optional[Temporada],
    params: Parametros,
    lista_cierres: List[Cierre],
    hoy: date,
    guardado: bool = False,
    destacado: bool = False,
    orden: int = 0,
) -> Dict:
    fechas = fechas_de(producto, temporada, params, lista_cierres)
    return {
        "id": producto.id,
        "nombre": producto.nombre,
        "categoria_visible": producto.categoria_visible,
        "linea_producto": producto.linea_producto,
        "pais_origen": producto.pais_origen,
        "fotos": list(producto.fotos or []),
        "por_que_ahora": producto.por_que_ahora,
        "temporada": (
            {"id": temporada.id, "nombre": temporada.nombre, "fecha": temporada.fecha.isoformat()}
            if temporada else None
        ),
        "transporte_sugerido": producto.transporte_sugerido,
        "dias_mar": producto.dias_mar,
        "dias_aereo": producto.dias_aereo,
        "revisar_requisitos": bool(producto.revisar_requisitos),
        "para_negocio": bool(producto.para_negocio),
        "guia_para_quien": producto.guia_para_quien,
        "guia_angulos": list(producto.guia_angulos or []),
        "guia_donde": producto.guia_donde,
        "guia_contenido": producto.guia_contenido,
        "que_pedir_en_cotizacion": producto.que_pedir_en_cotizacion,
        "pagina_prueba": bool(producto.pagina_prueba),
        "fechas": serializar_fechas(fechas, hoy),
        "guardado": guardado,
        "destacado": destacado,
        "orden": orden,
    }


def temporadas_por_id(db: Session, ids: Iterable[Optional[str]]) -> Dict[str, Temporada]:
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    return {t.id: t for t in db.query(Temporada).filter(Temporada.id.in_(ids)).all()}


def productos_de_edicion(db: Session, edicion_id: str) -> List[tuple]:
    """(EdicionProducto, ProductoTendencia) en orden de la edición."""
    return (
        db.query(EdicionProducto, ProductoTendencia)
        .join(ProductoTendencia, ProductoTendencia.id == EdicionProducto.producto_id)
        .filter(EdicionProducto.edicion_id == edicion_id)
        .order_by(EdicionProducto.destacado.desc(), EdicionProducto.orden.asc())
        .all()
    )


def serializar_edicion(
    db: Session,
    edicion: EdicionTendencias,
    *,
    usuario_id: Optional[str],
    hoy: Optional[date] = None,
    ocultar_fuera_de_tiempo: bool = True,
) -> Dict:
    hoy = hoy or hoy_bogota()
    params = parametros(db)
    lista_cierres = cierres(db)
    filas = productos_de_edicion(db, edicion.id)
    temporadas = temporadas_por_id(db, (p.temporada_id for _, p in filas))
    guardados = set()
    if usuario_id:
        guardados = {
            g.producto_id for g in db.query(GuardadoTendencia.producto_id)
            .filter(GuardadoTendencia.usuario_id == usuario_id).all()
        }
    productos = []
    for ep, producto in filas:
        item = serializar_producto(
            producto,
            temporada=temporadas.get(producto.temporada_id),
            params=params,
            lista_cierres=lista_cierres,
            hoy=hoy,
            guardado=producto.id in guardados,
            destacado=bool(ep.destacado),
            orden=ep.orden,
        )
        # Al comprador no se le muestra lo que ya no llega ni por aéreo.
        if ocultar_fuera_de_tiempo and item["fechas"]["estado"] == "fuera_de_tiempo":
            continue
        productos.append(item)
    return {
        **serializar_portada(edicion),
        "productos": productos,
        "pie": PIE_INFORMATIVO,
    }


def serializar_portada(edicion: EdicionTendencias) -> Dict:
    return {
        "id": edicion.id,
        "numero": edicion.numero,
        "semana_inicio": edicion.semana_inicio.isoformat(),
        "titulo_linea1": edicion.titulo_linea1,
        "titulo_linea2": edicion.titulo_linea2,
        "subtitulo": edicion.subtitulo,
        "preset_estilo": edicion.preset_estilo,
        "estado": edicion.estado,
        "publicar_en": edicion.publicar_en.isoformat() + "Z" if edicion.publicar_en else None,
        "publicada_en": edicion.publicada_en.isoformat() + "Z" if edicion.publicada_en else None,
    }


def edicion_publicada(db: Session) -> Optional[EdicionTendencias]:
    return (
        db.query(EdicionTendencias)
        .filter(EdicionTendencias.estado == EstadoEdicion.publicada.value)
        .order_by(EdicionTendencias.publicada_en.desc())
        .first()
    )


def proximas_temporadas(db: Session, hoy: date, meses: int = 14) -> List[Temporada]:
    hasta = hoy + timedelta(days=int(meses * 30.5))
    return (
        db.query(Temporada)
        .filter(Temporada.fecha >= hoy, Temporada.fecha <= hasta)
        .order_by(Temporada.fecha)
        .all()
    )


def serializar_temporada_con_limites(t: Temporada, params: Parametros, lista_cierres: List[Cierre], hoy: date) -> Dict:
    fechas = calcular_fechas(
        fecha_en_bodega_explicita=None,
        fecha_temporada=t.fecha,
        parametros=params,
        cierres=lista_cierres,
    )
    return {
        "id": t.id,
        "nombre": t.nombre,
        "fecha": t.fecha.isoformat(),
        "ejemplos": t.ejemplos,
        "fechas": serializar_fechas(fechas, hoy),
    }


# ── Validación y publicación ─────────────────────────────────────────────────

def problemas_para_publicar(db: Session, edicion: EdicionTendencias) -> List[str]:
    filas = productos_de_edicion(db, edicion.id)
    problemas = []
    if not filas:
        problemas.append("La edición no tiene productos.")
    if len(filas) > MAX_PRODUCTOS_POR_EDICION:
        problemas.append(f"La edición tiene más de {MAX_PRODUCTOS_POR_EDICION} productos.")
    destacados = sum(1 for ep, _ in filas if ep.destacado)
    if filas and destacados != 1:
        problemas.append("La edición debe tener exactamente un producto destacado.")
    for _, producto in filas:
        if not producto.fotos:
            problemas.append(f"«{producto.nombre}» no tiene fotos.")
    return problemas


def registrar_cambio(
    db: Session,
    *,
    accion: str,
    usuario_id: Optional[str],
    edicion: Optional[EdicionTendencias] = None,
    producto_id: Optional[str] = None,
    datos: Optional[Dict] = None,
) -> None:
    db.add(CambioTendencias(
        edicion_id=edicion.id if edicion else None,
        producto_id=producto_id,
        usuario_id=usuario_id,
        accion=accion,
        sobre_publicada=bool(edicion and edicion.estado == EstadoEdicion.publicada.value),
        datos=datos,
    ))


def ediciones_publicadas_con_producto(db: Session, producto_id: str) -> List[EdicionTendencias]:
    return (
        db.query(EdicionTendencias)
        .join(EdicionProducto, EdicionProducto.edicion_id == EdicionTendencias.id)
        .filter(EdicionProducto.producto_id == producto_id,
                EdicionTendencias.estado == EstadoEdicion.publicada.value)
        .all()
    )


def publicar_pendientes(db: Session, ahora: Optional[datetime] = None) -> List[str]:
    """Publica las ediciones programadas cuya hora ya llegó y archiva la que
    estaba publicada. Solo puede haber una publicada a la vez.

    Corre en cada worker; la transición es un UPDATE condicionado al estado,
    así que solo uno gana cada edición y solo ese manda el aviso.
    """
    ahora = ahora or datetime.utcnow()
    publicadas = []
    pendientes = (
        db.query(EdicionTendencias)
        .filter(
            EdicionTendencias.estado == EstadoEdicion.programada.value,
            EdicionTendencias.publicar_en <= ahora,
        )
        .order_by(EdicionTendencias.publicar_en.asc())
        .all()
    )
    for edicion in pendientes:
        ganado = (
            db.query(EdicionTendencias)
            .filter(EdicionTendencias.id == edicion.id,
                    EdicionTendencias.estado == EstadoEdicion.programada.value)
            .update({EdicionTendencias.estado: EstadoEdicion.publicada.value,
                     EdicionTendencias.publicada_en: ahora},
                    synchronize_session=False)
        )
        if ganado != 1:
            db.rollback()
            continue
        db.query(EdicionTendencias).filter(
            EdicionTendencias.id != edicion.id,
            EdicionTendencias.estado == EstadoEdicion.publicada.value,
        ).update({EdicionTendencias.estado: EstadoEdicion.archivada.value}, synchronize_session=False)
        db.add(CambioTendencias(edicion_id=edicion.id, accion="publicada", datos={"automatica": True}))
        db.commit()
        db.refresh(edicion)
        publicadas.append(edicion.id)
        try:
            enviar_aviso(db, edicion)
        except Exception:
            db.rollback()
            logger.exception("No se pudo enviar el aviso de la edición %s", edicion.numero)
    return publicadas


def enviar_aviso(db: Session, edicion: EdicionTendencias) -> int:
    """Aviso semanal (en la app y por correo) a quienes lo autorizaron y
    tienen acceso vigente. Devuelve a cuántos se envió."""
    from services.notificacion_service import notificar

    filas = productos_de_edicion(db, edicion.id)
    destacado = next((p for ep, p in filas if ep.destacado), None)
    ahora = datetime.utcnow()
    suscritos = (
        db.query(Usuario)
        .join(SuscripcionAvisoTendencias, SuscripcionAvisoTendencias.usuario_id == Usuario.id)
        .filter(Usuario.activo.is_(True))
        .all()
    )
    enviados = 0
    for usuario in suscritos:
        if not puede_curar(usuario) and acceso_vigente(db, usuario.id, ahora) is None:
            continue
        mensaje = edicion.subtitulo
        if destacado is not None:
            mensaje = f"{mensaje} Destacado de la semana: {destacado.nombre}."
        notificar(
            db,
            usuario_id=usuario.id,
            tipo="tendencias",
            titulo=f"Tendencias #{edicion.numero}: {edicion.titulo_linea1} {edicion.titulo_linea2}",
            mensaje=mensaje,
            data={"edicion_id": edicion.id},
            enlace_relativo=f"/tendencias?src=aviso&edicion={edicion.id}",
            whatsapp=False,
        )
        enviados += 1
    edicion.aviso_enviado_en = ahora
    db.commit()
    return enviados


# ── Fotos ────────────────────────────────────────────────────────────────────

def es_foto_de_tendencias_visible(db: Session, archivo_id: str, usuario: Optional[Usuario]) -> bool:
    """Las fotos de los productos las sube el curador; las ven quienes tienen
    acceso a Tendencias."""
    if usuario is None:
        return False
    referenciada = (
        db.query(ProductoTendencia.id)
        .filter(func.cast(ProductoTendencia.fotos, String).like(f"%{archivo_id}%"))
        .first()
    )
    return referenciada is not None and tiene_acceso(db, usuario)


def numero_siguiente(db: Session) -> int:
    return int((db.query(func.max(EdicionTendencias.numero)).scalar() or 0) + 1)


def lunes_de(d: date) -> date:
    return d - timedelta(days=d.weekday())

