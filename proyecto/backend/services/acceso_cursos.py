"""Acceso a cursos mientras no hay pasarela de pago.

Con el módulo «Pago manual de cursos» encendido, un curso con precio no se
compra directo: el usuario sube el comprobante en Pagos y, cuando el equipo lo
aprueba, queda con acceso. El admin también puede dar (o quitar) el acceso a
mano desde «Accesos a cursos», por ejemplo cuando el pago llegó por correo.

El acceso es la fila de `compras_curso` (la misma que deja la compra directa),
así que el resto del LMS (contenido, progreso, certificado) no cambia.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.comprobante import ComprobantePago, EstadoComprobante, TipoComprobante
from models.curso import CompraCurso, Curso, EstadoCurso, OrigenAccesoCurso
from models.importador import Importador
from models.usuario import Usuario


def pago_manual_activo(db: Session) -> bool:
    from services import modulos

    return modulos.activo(db, "academico") and modulos.activo(db, "pago_manual_cursos")


def requiere_comprobante(db: Session, curso: Curso) -> bool:
    """¿Este curso se paga con comprobante? Los gratis siguen siendo de inscripción directa."""
    return float(curso.precio or 0) > 0 and pago_manual_activo(db)


def tiene_acceso(db: Session, usuario_id: str, curso_id: str) -> bool:
    return db.query(CompraCurso.id).filter(
        CompraCurso.curso_id == curso_id, CompraCurso.usuario_id == usuario_id).first() is not None


def comprobante_pendiente(db: Session, usuario_id: str, curso_id: str) -> Optional[ComprobantePago]:
    return db.query(ComprobantePago).filter(
        ComprobantePago.usuario_id == usuario_id,
        ComprobantePago.curso_id == curso_id,
        ComprobantePago.tipo == TipoComprobante.curso.value,
        ComprobantePago.estado == EstadoComprobante.pendiente.value,
    ).first()


def curso_pagable(db: Session, curso_id: str) -> Curso:
    """Un curso publicado que se puede pagar (o al que se puede dar acceso)."""
    curso = db.query(Curso).filter(Curso.id == curso_id, Curso.deleted_at.is_(None)).first()
    if curso is None or curso.estado != EstadoCurso.publicado.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")
    return curso


def otorgar(db: Session, *, usuario_id: str, curso: Curso, origen: str, otorgado_por: Optional[str] = None,
            precio_pagado: Optional[float] = None, comprobante_id: Optional[str] = None,
            nota: Optional[str] = None) -> tuple:
    """Da acceso al curso. Devuelve `(acceso, nuevo)`; si ya lo tenía, no duplica."""
    existente = db.query(CompraCurso).filter(
        CompraCurso.curso_id == curso.id, CompraCurso.usuario_id == usuario_id).first()
    if existente is not None:
        return existente, False
    acceso = CompraCurso(
        curso_id=curso.id, usuario_id=usuario_id, origen=origen, otorgado_por=otorgado_por,
        precio_pagado=float(precio_pagado if precio_pagado is not None else (curso.precio or 0)),
        comprobante_id=comprobante_id, nota=(nota or "").strip()[:300] or None, fecha_compra=datetime.utcnow(),
    )
    try:
        with db.begin_nested():
            db.add(acceso)
            db.flush()
    except IntegrityError:
        # Otra petición le dio el acceso al mismo tiempo.
        return db.query(CompraCurso).filter(
            CompraCurso.curso_id == curso.id, CompraCurso.usuario_id == usuario_id).one(), False
    db.query(Curso).filter(Curso.id == curso.id).update(
        {Curso.estudiantes_count: Curso.estudiantes_count + 1}, synchronize_session=False)
    return acceso, True


def avisar_acceso(db: Session, usuario_id: str, curso: Curso, evento: str) -> None:
    """Correo desde pagos@ (y campana): ya puede entrar al curso."""
    from services.notificacion_service import notificar

    notificar(
        db, usuario_id=usuario_id, tipo="curso", titulo="Ya tienes acceso a tu curso",
        mensaje=f"Confirmamos tu pago: ya puedes empezar «{curso.titulo}» en Cursos.",
        data={"evento": evento, "curso_id": curso.id, "slug": curso.slug},
        enlace_relativo="/cursos", whatsapp=False, email=True, buzon="pagos",
    )


# ── Admin: accesos a mano ────────────────────────────────────────────────────

def dar_acceso_manual(db: Session, admin: Usuario, *, curso_id: str, email: str,
                      nota: Optional[str] = None) -> CompraCurso:
    curso = curso_pagable(db, curso_id)
    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == email.strip().lower()).first()
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="No hay una cuenta con ese correo. Créala primero en Usuarios.")
    acceso, nuevo = otorgar(db, usuario_id=usuario.id, curso=curso, origen=OrigenAccesoCurso.manual.value,
                            otorgado_por=admin.id, nota=nota)
    if not nuevo:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esa persona ya tiene acceso a este curso")
    avisar_acceso(db, usuario.id, curso, "acceso_curso_manual")
    return acceso


def quitar_acceso(db: Session, acceso_id: str) -> None:
    acceso = db.query(CompraCurso).filter(CompraCurso.id == acceso_id).first()
    if acceso is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Acceso no encontrado")
    db.query(Curso).filter(Curso.id == acceso.curso_id, Curso.estudiantes_count > 0).update(
        {Curso.estudiantes_count: Curso.estudiantes_count - 1}, synchronize_session=False)
    db.delete(acceso)


def catalogo_publicado(db: Session) -> List[Dict]:
    """Los cursos publicados, para elegir a cuál dar acceso."""
    cursos = (db.query(Curso).filter(Curso.deleted_at.is_(None), Curso.estado == EstadoCurso.publicado.value)
              .order_by(Curso.titulo.asc()).limit(500).all())
    nombres = dict(db.query(Importador.id, Importador.nombre_empresa)
                   .filter(Importador.id.in_({c.importador_id for c in cursos} or {""})).all())
    return [{
        "id": c.id, "titulo": c.titulo, "precio": float(c.precio or 0),
        "importadora_nombre": nombres.get(c.importador_id), "estudiantes": int(c.estudiantes_count or 0),
    } for c in cursos]


def listar_accesos(db: Session, *, curso_id: Optional[str] = None, q: Optional[str] = None) -> List[Dict]:
    consulta = (db.query(CompraCurso, Curso, Usuario)
                .join(Curso, Curso.id == CompraCurso.curso_id)
                .join(Usuario, Usuario.id == CompraCurso.usuario_id))
    if curso_id:
        consulta = consulta.filter(CompraCurso.curso_id == curso_id)
    if q and q.strip():
        from utils.query_safety import like_contains_pattern

        consulta = consulta.filter(Usuario.email.ilike(like_contains_pattern(q.strip()[:120]), escape="\\"))
    filas = consulta.order_by(CompraCurso.fecha_compra.desc()).limit(500).all()
    otorgantes = {u.id: u.email for u in db.query(Usuario).filter(
        Usuario.id.in_({a.otorgado_por for a, _, _ in filas if a.otorgado_por} or {""})).all()}
    return [{
        "id": acceso.id,
        "curso": {"id": curso.id, "titulo": curso.titulo},
        "usuario": {
            "id": usuario.id, "email": usuario.email,
            "nombre": " ".join(x for x in (usuario.nombre, usuario.apellido) if x) or None,
        },
        "origen": acceso.origen or OrigenAccesoCurso.inscripcion.value,
        "precio_pagado": float(acceso.precio_pagado or 0),
        "otorgado_por": otorgantes.get(acceso.otorgado_por),
        "nota": acceso.nota,
        "fecha": acceso.fecha_compra.isoformat() + "Z" if acceso.fecha_compra else None,
    } for acceso, curso, usuario in filas]
