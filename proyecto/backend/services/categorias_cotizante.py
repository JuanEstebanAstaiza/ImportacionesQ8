"""Categorías de cotizante (ver models/categoria_cotizante.py).

`aplicar` le pone la categoría a un cotizante con lo que trae: el tier (fijo,
`tier_manual`) y los días de Tendencias como cortesía. No hace commit.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.categoria_cotizante import CategoriaCotizante
from models.usuario import ORDEN_TIERS_COTIZANTE, Usuario


def _error(codigo: int, mensaje: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=mensaje)


def a_dict(c: CategoriaCotizante, cotizantes: int = 0) -> Dict:
    return {
        "id": c.id, "nombre": c.nombre, "descripcion": c.descripcion, "tier": c.tier,
        "dias_tendencias": c.dias_tendencias, "activa": bool(c.activa), "cotizantes": cotizantes,
        "fecha_creacion": c.fecha_creacion.isoformat() + "Z" if c.fecha_creacion else None,
    }


def listar(db: Session) -> List[Dict]:
    conteos = dict(db.query(Usuario.categoria_id, func.count(Usuario.id))
                   .filter(Usuario.categoria_id.isnot(None)).group_by(Usuario.categoria_id).all())
    filas = db.query(CategoriaCotizante).order_by(CategoriaCotizante.activa.desc(), CategoriaCotizante.nombre.asc()).all()
    return [a_dict(c, int(conteos.get(c.id, 0))) for c in filas]


def nombres(db: Session) -> Dict[str, str]:
    return dict(db.query(CategoriaCotizante.id, CategoriaCotizante.nombre).all())


def _validar(db: Session, datos: Dict, actual: Optional[CategoriaCotizante] = None) -> Dict:
    if "nombre" in datos and datos["nombre"] is not None:
        datos["nombre"] = datos["nombre"].strip()
        repetida = db.query(CategoriaCotizante.id).filter(
            func.lower(CategoriaCotizante.nombre) == datos["nombre"].lower())
        if actual is not None:
            repetida = repetida.filter(CategoriaCotizante.id != actual.id)
        if repetida.first():
            raise _error(status.HTTP_409_CONFLICT, "Ya hay una categoría con ese nombre")
    if datos.get("tier") and datos["tier"] not in ORDEN_TIERS_COTIZANTE:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tier inválido")
    if "descripcion" in datos:
        datos["descripcion"] = (datos["descripcion"] or "").strip() or None
    return datos


def crear(db: Session, datos: Dict, admin_id: str) -> CategoriaCotizante:
    datos = _validar(db, datos)
    categoria = CategoriaCotizante(**datos, creado_por=admin_id)
    db.add(categoria)
    db.flush()
    return categoria


def actualizar(db: Session, categoria_id: str, datos: Dict) -> CategoriaCotizante:
    categoria = obtener(db, categoria_id)
    for campo, valor in _validar(db, datos, categoria).items():
        setattr(categoria, campo, valor)
    return categoria


def obtener(db: Session, categoria_id: str, *, activa: bool = False) -> CategoriaCotizante:
    categoria = db.query(CategoriaCotizante).filter(CategoriaCotizante.id == categoria_id).first()
    if categoria is None:
        raise _error(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")
    if activa and not categoria.activa:
        raise _error(status.HTTP_409_CONFLICT, "Esa categoría está archivada")
    return categoria


def aplicar(db: Session, usuario: Usuario, categoria: CategoriaCotizante, admin_id: str,
            tier: Optional[str] = None) -> Optional[str]:
    """Le pone la categoría y le da lo que trae. `tier` (elegido a mano en el
    formulario) manda sobre el de la categoría. Devuelve hasta cuándo quedó con
    Tendencias (ISO) si la categoría lo incluye."""
    from models.tendencias import OrigenAcceso
    from services.tendencias import otorgar_acceso

    usuario.categoria_id = categoria.id
    tier = tier or categoria.tier
    if tier:
        usuario.tier = tier
        usuario.tier_manual = True
    if categoria.dias_tendencias:
        acceso = otorgar_acceso(db, usuario_id=usuario.id, dias=int(categoria.dias_tendencias),
                                origen=OrigenAcceso.cortesia.value, otorgado_por=admin_id,
                                nota=f"Categoría «{categoria.nombre}»")
        return acceso.fin.isoformat() + "Z"
    return None
