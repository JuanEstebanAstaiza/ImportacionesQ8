"""Tendencias semanales: lo que ve el comprador, el panel del curador y la
administración de accesos. Ver models/tendencias.py."""
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import config
from models.cotizacion import Cotizacion
from models.evento import Evento
from models.orden import Orden
from models.pago import EstadoPago, Pago
from models.tendencias import (
    AccesoTendencias, CambioTendencias, CierreFabricas, EdicionProducto, EdicionTendencias,
    EstadoEdicion, GuardadoTendencia, OrigenAcceso, ProductoTendencia, SuscripcionAvisoTendencias,
    Temporada,
)
from models.usuario import Usuario
from schemas import tendencias as sch
from services import configuracion, tendencias as svc
from services.eventos import registrar_evento
from services.tendencias_calculo import bogota_a_utc, calcular_fechas, hoy_bogota, utc_a_bogota
from utils.dependencies import get_current_user, get_db, require_rol

router = APIRouter(prefix="/tendencias", tags=["Tendencias"])

SIN_ACCESO = (
    "Tendencias es una sección para suscriptores. Suscríbete para ver la "
    "edición de esta semana."
)


# ── Dependencias ─────────────────────────────────────────────────────────────

def _usuario(db: Session, current_user: dict) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if usuario is None or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return usuario


def usuario_actual(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> Usuario:
    return _usuario(db, current_user)


def con_acceso(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)) -> Usuario:
    if not svc.tiene_acceso(db, usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=SIN_ACCESO)
    return usuario


def curador(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)) -> Usuario:
    if not svc.puede_curar(usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el equipo curador puede hacer esto")
    return usuario


def _evento(db: Session, tipo: str, usuario: Usuario, *, edicion_id=None, producto_id=None, datos=None) -> None:
    registrar_evento(
        db, f"tendencias.{tipo}",
        usuario={"user_id": usuario.id, "rol": usuario.rol},
        datos={k: v for k, v in {"edicion_id": edicion_id, "producto_id": producto_id, **(datos or {})}.items() if v},
    )


# ── Comprador: acceso y suscripción ──────────────────────────────────────────

@router.get("/acceso")
def mi_acceso(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    vigente = svc.acceso_vigente(db, usuario.id)
    hasta = svc.acceso_hasta(db, usuario.id)
    precio = svc.precio_suscripcion(db)
    aviso = db.query(SuscripcionAvisoTendencias).filter(SuscripcionAvisoTendencias.usuario_id == usuario.id).first()
    return {
        "tiene_acceso": svc.tiene_acceso(db, usuario),
        "es_curador": svc.puede_curar(usuario),
        "origen": vigente.origen if vigente else None,
        "vigente_hasta": hasta.isoformat() + "Z" if hasta else None,
        "precio_cop": precio,
        "dias_suscripcion": svc.dias_suscripcion(db),
        "venta_habilitada": precio is not None and usuario.rol == "solicitante",
        "pago_simulado": bool(getattr(config, "WOMPI_SIMULATE", True)),
        "aviso_suscrito": aviso is not None,
    }


@router.post("/suscripcion/checkout", status_code=status.HTTP_201_CREATED)
def iniciar_suscripcion(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    """Crea el pago pendiente de un periodo de suscripción y devuelve el enlace
    de Wompi. El acceso se activa cuando el webhook confirma el pago."""
    if usuario.rol != "solicitante":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="La suscripción a Tendencias es para cuentas de comprador")
    precio = svc.precio_suscripcion(db)
    if precio is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="La suscripción todavía no está a la venta")
    if config.APP_ENV == "production" and getattr(config, "WOMPI_SIMULATE", True):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Pagos Wompi no configurados para producción (WOMPI_SIMULATE=true)")

    dias = svc.dias_suscripcion(db)
    # Igual que la compra de créditos: referencia local mientras la integración
    # real con Wompi sigue pendiente (ver docs 03-Backend/Pagos-Wompi).
    wompi_payment_id = f"wpm_{secrets.token_hex(12)}"
    pago = Pago(
        usuario_id=usuario.id,
        wompi_payment_id=wompi_payment_id,
        monto_usd=0,
        monto_cop=float(precio),
        creditos_comprados=0,
        concepto=svc.CONCEPTO_PAGO_SUSCRIPCION,
        dias_acceso=dias,
        estado=EstadoPago.pendiente.value,
    )
    db.add(pago)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se pudo crear el pago, inténtalo de nuevo")
    return {
        "pago_id": pago.id,
        "wompi_payment_id": wompi_payment_id,
        "checkout_url": f"https://checkout.wompi.co/l/{wompi_payment_id}",
        "monto_cop": precio,
        "dias": dias,
        "pago_simulado": bool(getattr(config, "WOMPI_SIMULATE", True)),
    }


@router.post("/suscripcion/simular-pago/{pago_id}")
def simular_pago(pago_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    """Solo fuera de producción y con WOMPI_SIMULATE: confirma el pago como lo
    haría el webhook, para poder probar el flujo completo en local."""
    if config.APP_ENV == "production" or not getattr(config, "WOMPI_SIMULATE", True):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No disponible")
    pago = db.query(Pago).filter(Pago.id == pago_id, Pago.usuario_id == usuario.id).first()
    if pago is None or pago.concepto != svc.CONCEPTO_PAGO_SUSCRIPCION:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    ganado = (
        db.query(Pago)
        .filter(Pago.id == pago.id, Pago.estado == EstadoPago.pendiente.value)
        .update({Pago.estado: EstadoPago.confirmado.value, Pago.fecha_confirmacion: datetime.utcnow()},
                synchronize_session=False)
    )
    if ganado != 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El pago ya fue procesado")
    acceso = svc.activar_suscripcion_pagada(db, pago)
    db.commit()
    return {"vigente_hasta": acceso.fin.isoformat() + "Z"}


# ── Comprador: ediciones ─────────────────────────────────────────────────────

@router.get("/portada")
def portada_actual(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    """Lo que se le muestra a quien no tiene acceso: la portada y cuántos
    productos trae, sin los productos."""
    edicion = svc.edicion_publicada(db)
    if edicion is None:
        return {"edicion": None}
    filas = svc.productos_de_edicion(db, edicion.id)
    return {
        "edicion": svc.serializar_portada(edicion),
        "total_productos": len(filas),
        "categorias": [p.categoria_visible for _, p in filas],
        "pie": svc.PIE_INFORMATIVO,
    }


@router.get("/edicion-actual")
def edicion_actual(db: Session = Depends(get_db), usuario: Usuario = Depends(con_acceso)):
    edicion = svc.edicion_publicada(db)
    hoy = hoy_bogota()
    params = svc.parametros(db)
    lista_cierres = svc.cierres(db)
    pide_a_tiempo = [
        svc.serializar_temporada_con_limites(t, params, lista_cierres, hoy)
        for t in svc.proximas_temporadas(db, hoy)
    ]
    # "Pide a tiempo": las próximas cuatro temporadas que todavía llegan.
    pide_a_tiempo = [t for t in pide_a_tiempo if t["fechas"]["estado"] != "fuera_de_tiempo"][:4]
    return {
        "edicion": svc.serializar_edicion(db, edicion, usuario_id=usuario.id, hoy=hoy) if edicion else None,
        "pide_a_tiempo": pide_a_tiempo,
        "hoy": hoy.isoformat(),
        "pie": svc.PIE_INFORMATIVO,
    }


@router.get("/ediciones")
def archivo(db: Session = Depends(get_db), usuario: Usuario = Depends(con_acceso)):
    ediciones = (
        db.query(EdicionTendencias)
        .filter(EdicionTendencias.estado.in_((EstadoEdicion.publicada.value, EstadoEdicion.archivada.value)))
        .order_by(EdicionTendencias.numero.desc())
        .all()
    )
    return [svc.serializar_portada(e) for e in ediciones]


@router.get("/ediciones/{edicion_id}")
def ver_edicion(edicion_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(con_acceso)):
    edicion = db.query(EdicionTendencias).filter(EdicionTendencias.id == edicion_id).first()
    visible = edicion is not None and (
        edicion.estado in (EstadoEdicion.publicada.value, EstadoEdicion.archivada.value)
        or svc.puede_curar(usuario)
    )
    if not visible:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Edición no encontrada")
    # Las ediciones pasadas se muestran completas: son de solo lectura.
    return svc.serializar_edicion(
        db, edicion, usuario_id=usuario.id,
        ocultar_fuera_de_tiempo=edicion.estado == EstadoEdicion.publicada.value,
    )


@router.get("/calendario")
def calendario(db: Session = Depends(get_db), usuario: Usuario = Depends(con_acceso)):
    hoy = hoy_bogota()
    params = svc.parametros(db)
    lista_cierres = svc.cierres(db)
    return {
        "hoy": hoy.isoformat(),
        "hasta": (hoy + timedelta(days=427)).isoformat(),
        "temporadas": [
            svc.serializar_temporada_con_limites(t, params, lista_cierres, hoy)
            for t in svc.proximas_temporadas(db, hoy)
        ],
        "cierres": [
            {"inicio": c.inicio.isoformat(), "fin": c.fin.isoformat(),
             "fin_produccion_previa": c.fin_produccion_previa.isoformat()}
            for c in lista_cierres if c.fin >= hoy
        ],
        "parametros": {"dias_mar": params.dias_mar, "dias_aereo": params.dias_aereo,
                       "dias_produccion": params.dias_produccion},
        "pie": svc.PIE_INFORMATIVO,
    }


@router.get("/guardados")
def mis_guardados(db: Session = Depends(get_db), usuario: Usuario = Depends(con_acceso)):
    hoy = hoy_bogota()
    params = svc.parametros(db)
    lista_cierres = svc.cierres(db)
    filas = (
        db.query(GuardadoTendencia, ProductoTendencia)
        .join(ProductoTendencia, ProductoTendencia.id == GuardadoTendencia.producto_id)
        .filter(GuardadoTendencia.usuario_id == usuario.id)
        .order_by(GuardadoTendencia.fecha.desc())
        .all()
    )
    temporadas = svc.temporadas_por_id(db, (p.temporada_id for _, p in filas))
    return [
        {
            **svc.serializar_producto(p, temporada=temporadas.get(p.temporada_id), params=params,
                                      lista_cierres=lista_cierres, hoy=hoy, guardado=True),
            "edicion_id": g.edicion_id,
            "guardado_en": g.fecha.isoformat() + "Z",
        }
        for g, p in filas
    ]


@router.put("/guardados/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def guardar(producto_id: str, datos: sch.Guardar, db: Session = Depends(get_db),
            usuario: Usuario = Depends(con_acceso)):
    if db.query(ProductoTendencia.id).filter(ProductoTendencia.id == producto_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    existe = db.query(GuardadoTendencia).filter(
        GuardadoTendencia.usuario_id == usuario.id, GuardadoTendencia.producto_id == producto_id).first()
    if existe is None:
        db.add(GuardadoTendencia(usuario_id=usuario.id, producto_id=producto_id, edicion_id=datos.edicion_id))
        _evento(db, "producto_guardado", usuario, edicion_id=datos.edicion_id, producto_id=producto_id)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/guardados/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_guardado(producto_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(con_acceso)):
    borrados = db.query(GuardadoTendencia).filter(
        GuardadoTendencia.usuario_id == usuario.id, GuardadoTendencia.producto_id == producto_id,
    ).delete(synchronize_session=False)
    if borrados:
        _evento(db, "guardado_quitado", usuario, producto_id=producto_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/aviso", status_code=status.HTTP_204_NO_CONTENT)
def suscribir_aviso(db: Session = Depends(get_db), usuario: Usuario = Depends(con_acceso)):
    if db.query(SuscripcionAvisoTendencias).filter(SuscripcionAvisoTendencias.usuario_id == usuario.id).first() is None:
        db.add(SuscripcionAvisoTendencias(usuario_id=usuario.id, canal="email"))
        _evento(db, "aviso_suscrito", usuario)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/aviso", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_aviso(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    db.query(SuscripcionAvisoTendencias).filter(
        SuscripcionAvisoTendencias.usuario_id == usuario.id).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/eventos", status_code=status.HTTP_204_NO_CONTENT)
def evento_cliente(datos: sch.EventoTendencias, db: Session = Depends(get_db),
                   usuario: Usuario = Depends(con_acceso)):
    _evento(db, datos.tipo, usuario, edicion_id=datos.edicion_id, producto_id=datos.producto_id,
            datos={"modo": datos.modo} if datos.modo else None)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Curador: ediciones ───────────────────────────────────────────────────────

def _edicion_o_404(db: Session, edicion_id: str) -> EdicionTendencias:
    edicion = db.query(EdicionTendencias).filter(EdicionTendencias.id == edicion_id).first()
    if edicion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Edición no encontrada")
    return edicion


def _edicion_curador(db: Session, edicion: EdicionTendencias) -> dict:
    """La edición completa como la ve el curador: con todos los productos y su
    estado evaluado contra la fecha de publicación, no contra hoy."""
    referencia = utc_a_bogota(edicion.publicar_en).date() if edicion.publicar_en else hoy_bogota()
    datos = svc.serializar_edicion(db, edicion, usuario_id=None, hoy=referencia, ocultar_fuera_de_tiempo=False)
    datos["fecha_referencia"] = referencia.isoformat()
    datos["publicar_en_bogota"] = utc_a_bogota(edicion.publicar_en).isoformat() if edicion.publicar_en else None
    datos["problemas"] = svc.problemas_para_publicar(db, edicion)
    datos["fuera_de_tiempo"] = [
        p["nombre"] for p in datos["productos"] if p["fechas"]["estado"] == "fuera_de_tiempo"
    ]
    return datos


@router.get("/curaduria/ediciones")
def listar_ediciones(db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    ediciones = db.query(EdicionTendencias).order_by(EdicionTendencias.numero.desc()).all()
    conteo = dict(
        db.query(EdicionProducto.edicion_id, func.count(EdicionProducto.producto_id))
        .group_by(EdicionProducto.edicion_id).all()
    )
    return [{**svc.serializar_portada(e), "total_productos": int(conteo.get(e.id, 0))} for e in ediciones]


@router.post("/curaduria/ediciones", status_code=status.HTTP_201_CREATED)
def crear_edicion(datos: sch.EdicionCrear, db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    semana = svc.lunes_de(datos.semana_inicio)
    edicion = EdicionTendencias(
        numero=svc.numero_siguiente(db),
        semana_inicio=semana,
        titulo_linea1=datos.titulo_linea1.strip(),
        titulo_linea2=datos.titulo_linea2.strip(),
        subtitulo=datos.subtitulo.strip(),
        preset_estilo=datos.preset_estilo,
        estado=EstadoEdicion.borrador.value,
        # Por defecto, el lunes de esa semana a las 7:00 a. m. de Bogotá.
        publicar_en=bogota_a_utc(datetime.combine(semana, datetime.min.time()).replace(hour=7)),
        creado_por=usuario.id,
        actualizado_por=usuario.id,
    )
    db.add(edicion)
    db.flush()
    svc.registrar_cambio(db, accion="edicion_creada", usuario_id=usuario.id, edicion=edicion)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Otra edición tomó ese número; inténtalo de nuevo")
    return _edicion_curador(db, edicion)


@router.get("/curaduria/ediciones/{edicion_id}")
def ver_edicion_curador(edicion_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    return _edicion_curador(db, _edicion_o_404(db, edicion_id))


def _no_retirada(edicion: EdicionTendencias) -> None:
    if edicion.estado == EstadoEdicion.archivada.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Una edición archivada es de solo lectura")


@router.put("/curaduria/ediciones/{edicion_id}")
def editar_edicion(edicion_id: str, datos: sch.EdicionActualizar, db: Session = Depends(get_db),
                   usuario: Usuario = Depends(curador)):
    edicion = _edicion_o_404(db, edicion_id)
    _no_retirada(edicion)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    if "semana_inicio" in cambios:
        cambios["semana_inicio"] = svc.lunes_de(cambios["semana_inicio"])
    anteriores = {k: str(getattr(edicion, k)) for k in cambios}
    for campo, valor in cambios.items():
        setattr(edicion, campo, valor.strip() if isinstance(valor, str) else valor)
    edicion.actualizado_por = usuario.id
    edicion.fecha_actualizacion = datetime.utcnow()
    svc.registrar_cambio(db, accion="portada_editada", usuario_id=usuario.id, edicion=edicion,
                         datos={"antes": anteriores, "despues": {k: str(v) for k, v in cambios.items()}})
    db.commit()
    return _edicion_curador(db, edicion)


@router.put("/curaduria/ediciones/{edicion_id}/productos")
def productos_edicion(edicion_id: str, datos: sch.EdicionProductos, db: Session = Depends(get_db),
                      usuario: Usuario = Depends(curador)):
    edicion = _edicion_o_404(db, edicion_id)
    _no_retirada(edicion)
    ids = [p.producto_id for p in datos.productos]
    existentes = {p.id for p in db.query(ProductoTendencia.id).filter(ProductoTendencia.id.in_(ids)).all()} if ids else set()
    faltan = [i for i in ids if i not in existentes]
    if faltan:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Hay productos que no existen")
    if edicion.estado in (EstadoEdicion.programada.value, EstadoEdicion.publicada.value):
        if not ids or sum(1 for p in datos.productos if p.destacado) != 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Una edición programada o publicada necesita productos y exactamente un destacado")
    db.query(EdicionProducto).filter(EdicionProducto.edicion_id == edicion.id).delete(synchronize_session=False)
    for orden, p in enumerate(datos.productos):
        db.add(EdicionProducto(edicion_id=edicion.id, producto_id=p.producto_id, orden=orden, destacado=p.destacado))
    edicion.actualizado_por = usuario.id
    edicion.fecha_actualizacion = datetime.utcnow()
    svc.registrar_cambio(db, accion="productos_editados", usuario_id=usuario.id, edicion=edicion,
                         datos={"productos": [p.model_dump() for p in datos.productos]})
    db.commit()
    return _edicion_curador(db, edicion)


@router.post("/curaduria/ediciones/{edicion_id}/programar")
def programar(edicion_id: str, datos: sch.Programar, db: Session = Depends(get_db),
              usuario: Usuario = Depends(curador)):
    edicion = _edicion_o_404(db, edicion_id)
    if edicion.estado not in (EstadoEdicion.borrador.value, EstadoEdicion.programada.value):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se programan borradores")
    problemas = svc.problemas_para_publicar(db, edicion)
    if problemas:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=" ".join(problemas))
    ahora = datetime.utcnow()
    publicar_en = bogota_a_utc(datos.publicar_en.replace(tzinfo=None)) if datos.publicar_en else ahora
    edicion.publicar_en = publicar_en
    edicion.estado = EstadoEdicion.programada.value
    edicion.actualizado_por = usuario.id
    edicion.fecha_actualizacion = ahora
    svc.registrar_cambio(db, accion="programada", usuario_id=usuario.id, edicion=edicion,
                         datos={"publicar_en": publicar_en.isoformat() + "Z"})
    db.commit()
    if publicar_en <= ahora:
        svc.publicar_pendientes(db)
        db.refresh(edicion)
    return _edicion_curador(db, edicion)


@router.post("/curaduria/ediciones/{edicion_id}/desprogramar")
def desprogramar(edicion_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    edicion = _edicion_o_404(db, edicion_id)
    if edicion.estado != EstadoEdicion.programada.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La edición no está programada")
    edicion.estado = EstadoEdicion.borrador.value
    edicion.actualizado_por = usuario.id
    svc.registrar_cambio(db, accion="desprogramada", usuario_id=usuario.id, edicion=edicion)
    db.commit()
    return _edicion_curador(db, edicion)


@router.post("/curaduria/ediciones/{edicion_id}/retirar")
def retirar(edicion_id: str, db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    """Solo el admin retira una edición publicada: pasa a archivada y deja de
    verse como la edición de la semana."""
    edicion = _edicion_o_404(db, edicion_id)
    if edicion.estado != EstadoEdicion.publicada.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se retira la edición publicada")
    svc.registrar_cambio(db, accion="retirada", usuario_id=current_user["user_id"], edicion=edicion)
    edicion.estado = EstadoEdicion.archivada.value
    db.commit()
    return _edicion_curador(db, edicion)


@router.delete("/curaduria/ediciones/{edicion_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_edicion(edicion_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    edicion = _edicion_o_404(db, edicion_id)
    if edicion.estado != EstadoEdicion.borrador.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se borran ediciones en borrador")
    svc.registrar_cambio(db, accion="edicion_borrada", usuario_id=usuario.id, edicion=edicion,
                         datos={"numero": edicion.numero})
    db.query(EdicionProducto).filter(EdicionProducto.edicion_id == edicion.id).delete(synchronize_session=False)
    db.delete(edicion)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Curador: productos ───────────────────────────────────────────────────────

def _producto_o_404(db: Session, producto_id: str) -> ProductoTendencia:
    producto = db.query(ProductoTendencia).filter(ProductoTendencia.id == producto_id).first()
    if producto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return producto


def _validar_temporada(db: Session, temporada_id: Optional[str]) -> None:
    if temporada_id and db.query(Temporada.id).filter(Temporada.id == temporada_id).first() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La temporada no existe")


def _producto_curador(db: Session, producto: ProductoTendencia) -> dict:
    temporada = db.query(Temporada).filter(Temporada.id == producto.temporada_id).first() if producto.temporada_id else None
    datos = svc.serializar_producto(producto, temporada=temporada, params=svc.parametros(db),
                                    lista_cierres=svc.cierres(db), hoy=hoy_bogota())
    datos["fecha_en_bodega_explicita"] = producto.fecha_en_bodega.isoformat() if producto.fecha_en_bodega else None
    datos["temporada_id"] = producto.temporada_id
    datos["ediciones"] = [
        {"id": e.id, "numero": e.numero, "estado": e.estado}
        for e in db.query(EdicionTendencias)
        .join(EdicionProducto, EdicionProducto.edicion_id == EdicionTendencias.id)
        .filter(EdicionProducto.producto_id == producto.id)
        .order_by(EdicionTendencias.numero.desc()).all()
    ]
    return datos


@router.get("/curaduria/productos")
def listar_productos(db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    productos = db.query(ProductoTendencia).order_by(ProductoTendencia.fecha_actualizacion.desc()).all()
    temporadas = svc.temporadas_por_id(db, (p.temporada_id for p in productos))
    params, lista_cierres, hoy = svc.parametros(db), svc.cierres(db), hoy_bogota()
    ediciones: dict = {}
    for producto_id, e_id, numero, estado in (
        db.query(EdicionProducto.producto_id, EdicionTendencias.id, EdicionTendencias.numero, EdicionTendencias.estado)
        .join(EdicionTendencias, EdicionTendencias.id == EdicionProducto.edicion_id)
        .order_by(EdicionTendencias.numero.desc()).all()
    ):
        ediciones.setdefault(producto_id, []).append({"id": e_id, "numero": numero, "estado": estado})
    return [
        {**svc.serializar_producto(p, temporada=temporadas.get(p.temporada_id), params=params,
                                   lista_cierres=lista_cierres, hoy=hoy),
         "temporada_id": p.temporada_id,
         "fecha_en_bodega_explicita": p.fecha_en_bodega.isoformat() if p.fecha_en_bodega else None,
         "ediciones": ediciones.get(p.id, [])}
        for p in productos
    ]


@router.post("/curaduria/productos", status_code=status.HTTP_201_CREATED)
def crear_producto(datos: sch.ProductoDatos, db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    _validar_temporada(db, datos.temporada_id)
    producto = ProductoTendencia(**datos.model_dump(), creado_por=usuario.id, actualizado_por=usuario.id)
    db.add(producto)
    db.flush()
    svc.registrar_cambio(db, accion="producto_creado", usuario_id=usuario.id, producto_id=producto.id)
    db.commit()
    return _producto_curador(db, producto)


@router.get("/curaduria/productos/{producto_id}")
def ver_producto(producto_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    return _producto_curador(db, _producto_o_404(db, producto_id))


@router.put("/curaduria/productos/{producto_id}")
def editar_producto(producto_id: str, datos: sch.ProductoDatos, db: Session = Depends(get_db),
                    usuario: Usuario = Depends(curador)):
    producto = _producto_o_404(db, producto_id)
    _validar_temporada(db, datos.temporada_id)
    nuevos = datos.model_dump()
    cambiados = {k: v for k, v in nuevos.items() if getattr(producto, k) != v}
    for campo, valor in nuevos.items():
        setattr(producto, campo, valor)
    producto.actualizado_por = usuario.id
    producto.fecha_actualizacion = datetime.utcnow()
    # Si el producto está en la edición publicada, el cambio queda a la vista
    # del admin en la bitácora de esa edición.
    publicadas = svc.ediciones_publicadas_con_producto(db, producto.id)
    for edicion in publicadas or [None]:
        svc.registrar_cambio(db, accion="producto_editado", usuario_id=usuario.id, edicion=edicion,
                             producto_id=producto.id, datos={"campos": sorted(cambiados)})
    db.commit()
    return _producto_curador(db, producto)


@router.post("/curaduria/calcular")
def calcular(datos: sch.CalcularFechas, db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    """Cálculo en vivo del editor: fechas límite y estado contra la fecha de
    publicación de la edición."""
    temporada = None
    if datos.temporada_id:
        temporada = db.query(Temporada).filter(Temporada.id == datos.temporada_id).first()
    fechas = calcular_fechas(
        fecha_en_bodega_explicita=datos.fecha_en_bodega,
        fecha_temporada=temporada.fecha if temporada else None,
        parametros=svc.parametros(db),
        cierres=svc.cierres(db),
        dias_mar=datos.dias_mar,
        dias_aereo=datos.dias_aereo,
    )
    return svc.serializar_fechas(fechas, datos.fecha_referencia or hoy_bogota())


# ── Curador: calendario y parámetros ─────────────────────────────────────────

@router.get("/curaduria/temporadas")
def listar_temporadas(db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    return [
        {"id": t.id, "nombre": t.nombre, "fecha": t.fecha.isoformat(), "ejemplos": t.ejemplos}
        for t in db.query(Temporada).order_by(Temporada.fecha).all()
    ]


@router.post("/curaduria/temporadas", status_code=status.HTTP_201_CREATED)
def crear_temporada(datos: sch.TemporadaDatos, db: Session = Depends(get_db),
                    current_user: dict = Depends(require_rol("admin"))):
    temporada = Temporada(**datos.model_dump())
    db.add(temporada)
    db.commit()
    return {"id": temporada.id, "nombre": temporada.nombre, "fecha": temporada.fecha.isoformat(),
            "ejemplos": temporada.ejemplos}


@router.put("/curaduria/temporadas/{temporada_id}")
def editar_temporada(temporada_id: str, datos: sch.TemporadaDatos, db: Session = Depends(get_db),
                     current_user: dict = Depends(require_rol("admin"))):
    temporada = db.query(Temporada).filter(Temporada.id == temporada_id).first()
    if temporada is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Temporada no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(temporada, campo, valor)
    db.commit()
    return {"id": temporada.id, "nombre": temporada.nombre, "fecha": temporada.fecha.isoformat(),
            "ejemplos": temporada.ejemplos}


@router.delete("/curaduria/temporadas/{temporada_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_temporada(temporada_id: str, db: Session = Depends(get_db),
                     current_user: dict = Depends(require_rol("admin"))):
    if db.query(ProductoTendencia.id).filter(ProductoTendencia.temporada_id == temporada_id).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Hay productos con esta temporada. Cámbialos antes de borrarla.")
    db.query(Temporada).filter(Temporada.id == temporada_id).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _cierre_dict(c: CierreFabricas) -> dict:
    return {"id": c.id, "inicio": c.inicio.isoformat(), "fin": c.fin.isoformat(),
            "fin_produccion_previa": c.fin_produccion_previa.isoformat()}


@router.get("/curaduria/cierres")
def listar_cierres(db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    return [_cierre_dict(c) for c in db.query(CierreFabricas).order_by(CierreFabricas.inicio).all()]


@router.post("/curaduria/cierres", status_code=status.HTTP_201_CREATED)
def crear_cierre(datos: sch.CierreDatos, db: Session = Depends(get_db),
                 current_user: dict = Depends(require_rol("admin"))):
    cierre = CierreFabricas(**datos.model_dump())
    db.add(cierre)
    db.commit()
    return _cierre_dict(cierre)


@router.delete("/curaduria/cierres/{cierre_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_cierre(cierre_id: str, db: Session = Depends(get_db),
                  current_user: dict = Depends(require_rol("admin"))):
    db.query(CierreFabricas).filter(CierreFabricas.id == cierre_id).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/curaduria/parametros")
def ver_parametros(db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    params = svc.parametros(db)
    return {
        "dias_mar": params.dias_mar,
        "dias_aereo": params.dias_aereo,
        "dias_produccion": params.dias_produccion,
        "precio_cop": svc.precio_suscripcion(db),
        "dias_suscripcion": svc.dias_suscripcion(db),
    }


@router.put("/curaduria/parametros")
def guardar_parametros(datos: sch.Parametros, db: Session = Depends(get_db),
                       current_user: dict = Depends(require_rol("admin"))):
    uid = current_user["user_id"]
    configuracion.guardar(db, svc.CLAVE_DIAS_MAR, str(datos.dias_mar), uid)
    configuracion.guardar(db, svc.CLAVE_DIAS_AEREO, str(datos.dias_aereo), uid)
    configuracion.guardar(db, svc.CLAVE_DIAS_PRODUCCION, str(datos.dias_produccion), uid)
    configuracion.guardar(db, svc.CLAVE_PRECIO_COP, str(datos.precio_cop) if datos.precio_cop else None, uid)
    configuracion.guardar(db, svc.CLAVE_DIAS_SUSCRIPCION, str(datos.dias_suscripcion), uid)
    db.add(CambioTendencias(usuario_id=uid, accion="parametros_editados", datos=datos.model_dump()))
    db.commit()
    return ver_parametros(db=db, usuario=_usuario(db, current_user))


@router.get("/curaduria/cambios")
def bitacora(
    edicion_id: Optional[str] = None,
    solo_publicadas: bool = False,
    limite: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    consulta = db.query(CambioTendencias)
    if edicion_id:
        consulta = consulta.filter(CambioTendencias.edicion_id == edicion_id)
    if solo_publicadas:
        consulta = consulta.filter(CambioTendencias.sobre_publicada.is_(True))
    cambios = consulta.order_by(CambioTendencias.fecha.desc()).limit(limite).all()
    nombres = dict(
        db.query(Usuario.id, Usuario.nombre)
        .filter(Usuario.id.in_({c.usuario_id for c in cambios if c.usuario_id})).all()
    ) if cambios else {}
    return [
        {"id": c.id, "edicion_id": c.edicion_id, "producto_id": c.producto_id,
         "usuario": nombres.get(c.usuario_id) or ("Sistema" if not c.usuario_id else "—"),
         "accion": c.accion, "sobre_publicada": c.sobre_publicada, "datos": c.datos,
         "fecha": c.fecha.isoformat() + "Z"}
        for c in cambios
    ]


@router.get("/curaduria/metricas")
def metricas(db: Session = Depends(get_db), usuario: Usuario = Depends(curador)):
    """Por edición y por producto: vistas, guardados, clics en pedir
    propuestas, solicitudes creadas y cuántas terminaron en orden."""
    ediciones = db.query(EdicionTendencias).filter(
        EdicionTendencias.estado.in_((EstadoEdicion.publicada.value, EstadoEdicion.archivada.value))
    ).order_by(EdicionTendencias.numero.desc()).limit(26).all()
    if not ediciones:
        return []
    ids = [e.id for e in ediciones]

    eventos = db.query(Evento.tipo, Evento.datos).filter(Evento.tipo.like("tendencias.%")).all()
    contadores: dict = {}
    for tipo, datos in eventos:
        datos = datos or {}
        clave = (datos.get("edicion_id"), datos.get("producto_id"))
        nombre = tipo.split(".", 1)[1]
        for k in {clave, (clave[0], None)}:
            contadores.setdefault(k, {}).setdefault(nombre, 0)
            contadores[k][nombre] += 1

    solicitudes = (
        db.query(Cotizacion.id, Cotizacion.tendencia_edicion_id, Cotizacion.tendencia_producto_id)
        .filter(Cotizacion.origen == "tendencias", Cotizacion.tendencia_edicion_id.in_(ids))
        .all()
    )
    con_orden = {
        f[0] for f in db.query(Orden.cotizacion_id)
        .filter(Orden.cotizacion_id.in_([s.id for s in solicitudes])).all()
    } if solicitudes else set()

    def _cuenta(edicion_id, producto_id=None):
        sel = [s for s in solicitudes if s.tendencia_edicion_id == edicion_id
               and (producto_id is None or s.tendencia_producto_id == producto_id)]
        c = contadores.get((edicion_id, producto_id), {})
        return {
            "vistas": c.get("producto_visto" if producto_id else "edicion_vista", 0),
            "guardados": c.get("producto_guardado", 0),
            "clics_pedir_propuestas": c.get("pedir_propuestas_clic", 0),
            "solicitudes": len(sel),
            "operaciones": sum(1 for s in sel if s.id in con_orden),
        }

    resultado = []
    for e in ediciones:
        productos = svc.productos_de_edicion(db, e.id)
        resultado.append({
            **svc.serializar_portada(e),
            **_cuenta(e.id),
            "productos": [{"id": p.id, "nombre": p.nombre, **_cuenta(e.id, p.id)} for _, p in productos],
        })
    return resultado


# ── Admin: accesos y curadores ───────────────────────────────────────────────

def _acceso_dict(a: AccesoTendencias, usuario: Optional[Usuario], ahora: datetime) -> dict:
    return {
        "id": a.id,
        "usuario_id": a.usuario_id,
        "email": usuario.email if usuario else None,
        "nombre": usuario.nombre if usuario else None,
        "origen": a.origen,
        "inicio": a.inicio.isoformat() + "Z",
        "fin": a.fin.isoformat() + "Z",
        "nota": a.nota,
        "revocado": a.revocado_en is not None,
        "vigente": a.revocado_en is None and a.inicio <= ahora < a.fin,
    }


@router.get("/admin/accesos")
def listar_accesos(solo_vigentes: bool = True, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_rol("admin"))):
    ahora = datetime.utcnow()
    consulta = db.query(AccesoTendencias, Usuario).join(Usuario, Usuario.id == AccesoTendencias.usuario_id)
    if solo_vigentes:
        consulta = consulta.filter(AccesoTendencias.revocado_en.is_(None), AccesoTendencias.fin > ahora)
    filas = consulta.order_by(AccesoTendencias.fin.desc()).limit(500).all()
    return [_acceso_dict(a, u, ahora) for a, u in filas]


@router.post("/admin/accesos", status_code=status.HTTP_201_CREATED)
def otorgar_cortesia(datos: sch.OtorgarAcceso, db: Session = Depends(get_db),
                     current_user: dict = Depends(require_rol("admin"))):
    """Regala acceso por `dias` a un usuario existente, sin pago."""
    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == datos.email.lower()).first()
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay ninguna cuenta con ese correo")
    acceso = svc.otorgar_acceso(
        db, usuario_id=usuario.id, dias=datos.dias, origen=OrigenAcceso.cortesia.value,
        otorgado_por=current_user["user_id"], nota=datos.nota,
    )
    from services.notificacion_service import notificar

    notificar(
        db, usuario_id=usuario.id, tipo="tendencias",
        titulo="Tienes acceso a Tendencias",
        mensaje=f"El equipo de Zarpi te dio acceso a Tendencias por {datos.dias} días.",
        enlace_relativo="/tendencias", whatsapp=False,
    )
    db.commit()
    return _acceso_dict(acceso, usuario, datetime.utcnow())


@router.post("/admin/accesos/{acceso_id}/revocar")
def revocar_acceso(acceso_id: str, db: Session = Depends(get_db),
                   current_user: dict = Depends(require_rol("admin"))):
    acceso = db.query(AccesoTendencias).filter(AccesoTendencias.id == acceso_id).first()
    if acceso is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Acceso no encontrado")
    if acceso.revocado_en is None:
        acceso.revocado_en = datetime.utcnow()
        db.commit()
    usuario = db.query(Usuario).filter(Usuario.id == acceso.usuario_id).first()
    return _acceso_dict(acceso, usuario, datetime.utcnow())


@router.get("/admin/curadores")
def listar_curadores(db: Session = Depends(get_db), current_user: dict = Depends(require_rol("admin"))):
    return [
        {"id": u.id, "email": u.email, "nombre": u.nombre, "rol": u.rol}
        for u in db.query(Usuario).filter(Usuario.es_curador.is_(True)).order_by(Usuario.email).all()
    ]


@router.put("/admin/curadores")
def asignar_curador(email: str, datos: sch.Curador, db: Session = Depends(get_db),
                    current_user: dict = Depends(require_rol("admin"))):
    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == email.strip().lower()).first()
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay ninguna cuenta con ese correo")
    usuario.es_curador = datos.es_curador
    db.add(CambioTendencias(usuario_id=current_user["user_id"], accion="curador_asignado" if datos.es_curador else "curador_quitado",
                            datos={"usuario_id": usuario.id, "email": usuario.email}))
    db.commit()
    return {"id": usuario.id, "email": usuario.email, "nombre": usuario.nombre, "rol": usuario.rol,
            "es_curador": usuario.es_curador}

