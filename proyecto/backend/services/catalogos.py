"""Acceso a los catálogos selectos de las empresas importadoras."""
from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Set

from sqlalchemy import String, func, or_
from sqlalchemy.orm import Session

from models.catalogo import AccesoCatalogo, CatalogoEmpresa, CriterioCatalogo, ProductoCatalogo
from models.cotizacion import Cotizacion
from models.orden import Orden
from models.recepcion_cotizacion import RecepcionCotizacion
from models.usuario import ORDEN_TIERS_COTIZANTE, TierCotizante, Usuario
from services import tendencias

MAX_FOTOS_POR_PRODUCTO = 5

DESCRIPCION_CRITERIO = {
    CriterioCatalogo.manual.value: "Solo los clientes que la empresa elige",
    CriterioCatalogo.tier_minimo.value: "Clientes con nivel de cotizante {tier} o superior",
    CriterioCatalogo.clientes_con_orden.value: "Clientes con al menos una orden con la empresa",
    CriterioCatalogo.suscriptores_zarpi.value: "Suscriptores de Tendencias de Zarpi",
}


def describir_criterio(catalogo: CatalogoEmpresa) -> str:
    texto = DESCRIPCION_CRITERIO.get(catalogo.criterio, catalogo.criterio)
    return texto.format(tier=catalogo.tier_minimo or TierCotizante.bronze.value)


class ContextoComprador:
    """Lo que hace falta saber del comprador para evaluar todos los catálogos
    con pocas consultas."""

    def __init__(self, db: Session, usuario: Usuario):
        self.usuario = usuario
        self.orden_tier = ORDEN_TIERS_COTIZANTE.get(usuario.tier or TierCotizante.bronze.value, 0)
        self.empresas_con_orden: Set[str] = {
            fila[0] for fila in db.query(Orden.importador_id)
            .filter(Orden.solicitante_id == usuario.id).distinct().all()
        }
        self.suscriptor = tendencias.acceso_vigente(db, usuario.id) is not None
        self.manuales: Set[str] = {
            fila[0] for fila in db.query(AccesoCatalogo.catalogo_id)
            .filter(AccesoCatalogo.usuario_id == usuario.id).all()
        }

    def puede_ver(self, catalogo: CatalogoEmpresa) -> bool:
        if not catalogo.activo:
            return False
        return catalogo.id in self.manuales or self.cumple_criterio(catalogo)

    def acceso_por(self, catalogo: CatalogoEmpresa) -> str:
        """"criterio" si lo cumple; "manual" si solo entra por la lista de la empresa."""
        return "criterio" if self.cumple_criterio(catalogo) else "manual"

    def cumple_criterio(self, catalogo: CatalogoEmpresa) -> bool:
        if catalogo.criterio == CriterioCatalogo.tier_minimo.value:
            requerido = ORDEN_TIERS_COTIZANTE.get(catalogo.tier_minimo or TierCotizante.bronze.value, 0)
            return self.orden_tier >= requerido
        if catalogo.criterio == CriterioCatalogo.clientes_con_orden.value:
            return catalogo.importador_id in self.empresas_con_orden
        if catalogo.criterio == CriterioCatalogo.suscriptores_zarpi.value:
            return self.suscriptor
        return False


def puede_ver(db: Session, usuario: Usuario, catalogo: CatalogoEmpresa) -> bool:
    if usuario.rol == "admin":
        return True
    if usuario.importador_id and usuario.importador_id == catalogo.importador_id:
        return True
    if usuario.rol != "solicitante":
        return False
    return ContextoComprador(db, usuario).puede_ver(catalogo)


def catalogos_disponibles(db: Session, usuario: Usuario) -> List[tuple]:
    """(catálogo, "criterio" | "manual") de los que el comprador puede ver."""
    contexto = ContextoComprador(db, usuario)
    activos = (
        db.query(CatalogoEmpresa)
        .filter(CatalogoEmpresa.activo.is_(True))
        .order_by(CatalogoEmpresa.fecha_actualizacion.desc())
        .all()
    )
    return [(c, contexto.acceso_por(c)) for c in activos if contexto.puede_ver(c)]


def clientes_de_empresa(db: Session, importador_id: str) -> List[Dict]:
    """Compradores que ya tuvieron trato con la empresa: le enviaron una
    solicitud dirigida, recibió una abierta de ellos o tienen una orden. Es
    entre quienes la empresa puede elegir a mano; no ve al resto."""
    ids: Set[str] = set()
    ids.update(f[0] for f in db.query(Cotizacion.solicitante_id)
               .filter(Cotizacion.importador_id == importador_id).distinct().all())
    ids.update(f[0] for f in db.query(Cotizacion.solicitante_id)
               .join(RecepcionCotizacion, RecepcionCotizacion.cotizacion_id == Cotizacion.id)
               .filter(RecepcionCotizacion.importador_id == importador_id).distinct().all())
    ordenes: Dict[str, int] = dict(
        db.query(Orden.solicitante_id, func.count(Orden.id))
        .filter(Orden.importador_id == importador_id)
        .group_by(Orden.solicitante_id).all()
    )
    ids.update(ordenes.keys())
    if not ids:
        return []
    usuarios = (
        db.query(Usuario)
        .filter(Usuario.id.in_(ids), Usuario.rol == "solicitante", Usuario.activo.is_(True))
        .all()
    )
    return sorted(
        (
            {
                "usuario_id": u.id,
                "nombre": " ".join(x for x in (u.nombre, u.apellido) if x) or u.email.split("@")[0],
                # Solo para buscar en el servidor; no sale en la respuesta.
                "_email": u.email,
                "tier": u.tier or TierCotizante.bronze.value,
                "ordenes_con_empresa": int(ordenes.get(u.id, 0)),
            }
            for u in usuarios
        ),
        key=lambda c: (-c["ordenes_con_empresa"], c["nombre"].lower()),
    )


def es_cliente_de_empresa(db: Session, importador_id: str, usuario_id: str) -> bool:
    return any(c["usuario_id"] == usuario_id for c in clientes_de_empresa(db, importador_id))


def productos_activos(db: Session, catalogo_ids: Iterable[str]) -> Dict[str, List[ProductoCatalogo]]:
    ids = list(catalogo_ids)
    resultado: Dict[str, List[ProductoCatalogo]] = {i: [] for i in ids}
    if not ids:
        return resultado
    for p in (
        db.query(ProductoCatalogo)
        .filter(ProductoCatalogo.catalogo_id.in_(ids), ProductoCatalogo.activo.is_(True))
        .order_by(ProductoCatalogo.orden.asc(), ProductoCatalogo.fecha_creacion.asc())
        .all()
    ):
        resultado[p.catalogo_id].append(p)
    return resultado


def es_foto_de_catalogo_visible(db: Session, archivo_id: str, usuario: Optional[Usuario]) -> bool:
    if usuario is None:
        return False
    filas = (
        db.query(CatalogoEmpresa)
        .join(ProductoCatalogo, ProductoCatalogo.catalogo_id == CatalogoEmpresa.id)
        .filter(func.cast(ProductoCatalogo.fotos, String).like(f"%{archivo_id}%"))
        .all()
    )
    return any(puede_ver(db, usuario, c) for c in filas)


def es_foto_de_cotizacion_visible(db: Session, archivo_id: str, usuario: Optional[Usuario]) -> bool:
    """Las fotos del producto de una cotización las sube el comprador, pero las
    tiene que ver la empresa que la cotiza."""
    if usuario is None:
        return False
    patron = f"%/{archivo_id}/%"
    cotizaciones = (
        db.query(Cotizacion)
        .filter(or_(
            Cotizacion.foto_producto.like(patron),
            func.cast(Cotizacion.fotos_producto, String).like(f"%{archivo_id}%"),
        ))
        .all()
    )
    for cot in cotizaciones:
        if cot.solicitante_id == usuario.id or usuario.rol in ("admin", "soporte"):
            return True
        if not usuario.importador_id:
            continue
        if cot.importador_id == usuario.importador_id:
            return True
        recibida = (
            db.query(RecepcionCotizacion.id)
            .filter(RecepcionCotizacion.cotizacion_id == cot.id,
                    RecepcionCotizacion.importador_id == usuario.importador_id)
            .first()
        )
        if recibida is not None:
            return True
    return False
