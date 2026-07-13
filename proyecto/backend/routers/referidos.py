from uuid import uuid4
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.referido import CodigoReferido, ReferidoUso
from models.credito import MovimientoCredito, TipoMovimientoCredito
from schemas.features import CodigoReferidoResponse, EstadisticasReferidoResponse
from utils.dependencies import get_db, require_rol

router = APIRouter(prefix="/referidos", tags=["Referidos"])


def _nuevo_codigo() -> str:
    alfabeto = string.ascii_uppercase + string.digits
    return "Q8" + "".join(secrets.choice(alfabeto) for _ in range(8))


@router.get("/mi-codigo", response_model=CodigoReferidoResponse)
async def mi_codigo(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    """Obtiene o crea el código de referido del solicitante autenticado."""
    row = db.query(CodigoReferido).filter(CodigoReferido.usuario_id == current_user["user_id"]).first()
    if not row:
        for _ in range(5):
            codigo = _nuevo_codigo()
            if not db.query(CodigoReferido).filter(CodigoReferido.codigo == codigo).first():
                row = CodigoReferido(
                    id=str(uuid4()),
                    usuario_id=current_user["user_id"],
                    codigo=codigo,
                    activo=True,
                )
                db.add(row)
                db.commit()
                db.refresh(row)
                break
        if not row:
            raise HTTPException(status_code=500, detail="No se pudo generar código")
    return CodigoReferidoResponse(codigo=row.codigo, activo=row.activo)


@router.get("/estadisticas", response_model=EstadisticasReferidoResponse)
async def estadisticas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    row = db.query(CodigoReferido).filter(CodigoReferido.usuario_id == current_user["user_id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="Aún no tienes código; llama a GET /referidos/mi-codigo")
    usos = db.query(ReferidoUso).filter(ReferidoUso.codigo_id == row.id).count()
    ganados = db.query(func.coalesce(func.sum(MovimientoCredito.monto), 0.0)).filter(
        MovimientoCredito.usuario_id == current_user["user_id"],
        MovimientoCredito.tipo == TipoMovimientoCredito.bono_referidor.value,
    ).scalar()
    return EstadisticasReferidoResponse(
        codigo=row.codigo,
        usos=usos,
        creditos_ganados=float(ganados or 0),
    )
