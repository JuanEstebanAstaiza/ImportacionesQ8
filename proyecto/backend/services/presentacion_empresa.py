"""Moderación del material de presentación de las empresas importadoras.

Desde «Mi empresa» la importadora sube un video corto y fotos (también
certificados u otros soportes). Nada de eso sale en la ficha pública hasta que
el equipo de Zarpi lo aprueba: aquí se avisa al equipo de lo que llega, se
arma la cola de revisión del admin y se le cuenta a la empresa el resultado.
"""

from datetime import datetime
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.evidencia import EstadoEvidenciaImportador, EvidenciaImportador
from models.importador import Importador
from models.usuario import Usuario

ENLACE_ADMIN = "/admin/presentaciones"
ENLACE_EMPRESA = "/empresa/perfil"

NOMBRE_TIPO = {
    "video_presentacion": "video de presentación",
    "foto_producto": "foto de producto",
    "foto_fabrica": "foto de la fábrica",
    "certificado": "certificado",
    "catalogo": "catálogo",
    "moq_doc": "documento de pedido mínimo",
    "otro": "archivo",
}


def _nombre_tipo(tipo: str) -> str:
    return NOMBRE_TIPO.get(tipo, "archivo")


def a_dict(ev: EvidenciaImportador, empresa: Optional[str] = None) -> Dict:
    return {
        "id": ev.id,
        "importador_id": ev.importador_id,
        "empresa": empresa,
        "tipo": ev.tipo,
        "titulo": ev.titulo,
        "descripcion": ev.descripcion,
        "url": ev.url,
        "estado": ev.estado,
        "nota_revision": ev.nota_revision,
        "fecha_creacion": ev.fecha_creacion,
        "fecha_revision": ev.fecha_revision,
    }


def avisar_nueva(db: Session, ev: EvidenciaImportador) -> None:
    """Aviso in-app a los admins: hay material de una empresa esperando revisión."""
    from services.notificacion_service import notificar

    importador = db.query(Importador).filter(Importador.id == ev.importador_id).first()
    empresa = importador.nombre_empresa if importador else "Una empresa"
    for admin in db.query(Usuario).filter(Usuario.rol == "admin", Usuario.activo.is_(True)).all():
        notificar(
            db,
            usuario_id=admin.id,
            tipo="presentacion_empresa",
            titulo="Material de empresa por revisar",
            mensaje=f"{empresa} subió un {_nombre_tipo(ev.tipo)}: «{ev.titulo}».",
            data={"evidencia_id": ev.id, "importador_id": ev.importador_id},
            enlace_relativo=ENLACE_ADMIN,
            whatsapp=False,
            email=False,
        )


def listar(db: Session, estado: Optional[str] = None) -> List[Dict]:
    """Cola del admin. Las pendientes, de la más antigua a la más reciente (se
    atienden en orden de llegada); las ya revisadas, las últimas primero."""
    query = (
        db.query(EvidenciaImportador, Importador.nombre_empresa)
        .outerjoin(Importador, Importador.id == EvidenciaImportador.importador_id)
    )
    if estado:
        query = query.filter(EvidenciaImportador.estado == estado)
    if estado == EstadoEvidenciaImportador.pendiente.value:
        query = query.order_by(EvidenciaImportador.fecha_creacion.asc())
    else:
        query = query.order_by(EvidenciaImportador.fecha_creacion.desc())
    return [a_dict(ev, empresa) for ev, empresa in query.limit(300).all()]


def contadores(db: Session) -> Dict[str, int]:
    filas = db.query(EvidenciaImportador.estado).all()
    conteo = {e.value: 0 for e in EstadoEvidenciaImportador}
    for (estado,) in filas:
        conteo[estado] = conteo.get(estado, 0) + 1
    return conteo


def revisar(db: Session, evidencia_id: str, estado: str, nota: Optional[str], admin_id: str) -> EvidenciaImportador:
    """Aprueba o rechaza (también sirve para despublicar algo ya aprobado).
    El rechazo exige motivo: es lo único que la empresa ve para corregirlo."""
    ev = db.query(EvidenciaImportador).filter(EvidenciaImportador.id == evidencia_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada")
    if estado not in (EstadoEvidenciaImportador.aprobada.value, EstadoEvidenciaImportador.rechazada.value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Estado inválido")
    nota = (nota or "").strip() or None
    if estado == EstadoEvidenciaImportador.rechazada.value and not nota:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Escribe el motivo del rechazo: es lo que la empresa verá para corregirlo.",
        )

    ev.estado = estado
    ev.nota_revision = nota
    ev.revisado_por_admin_id = admin_id
    ev.fecha_revision = datetime.utcnow()
    _avisar_empresa(db, ev)
    return ev


def _avisar_empresa(db: Session, ev: EvidenciaImportador) -> None:
    from services.notificacion_service import notificar

    aprobada = ev.estado == EstadoEvidenciaImportador.aprobada.value
    if aprobada:
        titulo = "Tu material ya está publicado"
        mensaje = f"El equipo de Zarpi aprobó tu {_nombre_tipo(ev.tipo)} «{ev.titulo}». Ya se ve en tu perfil público."
    else:
        titulo = "Tu material no fue aprobado"
        mensaje = f"El equipo de Zarpi no aprobó tu {_nombre_tipo(ev.tipo)} «{ev.titulo}». Motivo: {ev.nota_revision}"

    duenos = (
        db.query(Usuario)
        .filter(Usuario.importador_id == ev.importador_id, Usuario.rol == "importador", Usuario.activo.is_(True))
        .all()
    )
    for dueno in duenos:
        notificar(
            db,
            usuario_id=dueno.id,
            tipo="presentacion_empresa",
            titulo=titulo,
            mensaje=mensaje,
            data={"evidencia_id": ev.id, "estado": ev.estado},
            enlace_relativo=ENLACE_EMPRESA,
            whatsapp=False,
        )
