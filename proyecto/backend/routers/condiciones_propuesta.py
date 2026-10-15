"""«Mi empresa › Condiciones de tus propuestas» (ver services/formulario_propuesta.py).

Las llena la cuenta dueña una vez; cada propuesta nueva las trae listas. Los
asesores las leen para redactar borradores.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from services import formulario_propuesta as fp
from utils.dependencies import get_db, require_rol, require_rol_in

router = APIRouter(prefix="/condiciones-propuesta", tags=["Propuestas"])


def _empresa(current_user: dict) -> str:
    importador_id = current_user.get("importador_id")
    if not importador_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="La cuenta no está asociada a ninguna empresa importadora")
    return importador_id


def _respuesta(db: Session, importador_id: str) -> dict:
    return {
        **fp.condiciones_de(db, importador_id).model_dump(),
        # Para avisar en el formulario que conviene llenarlas antes de proponer.
        "configuradas": fp.tiene_condiciones(db, importador_id),
    }


@router.get("")
def ver_condiciones(db: Session = Depends(get_db),
                    current_user: dict = Depends(require_rol_in("importador", "asesor"))):
    return _respuesta(db, _empresa(current_user))


@router.put("")
def guardar_condiciones(datos: fp.CondicionesPropuesta, db: Session = Depends(get_db),
                        current_user: dict = Depends(require_rol("importador"))):
    importador_id = _empresa(current_user)
    fp.guardar_condiciones(db, importador_id, datos, current_user.get("user_id"))
    db.commit()
    return _respuesta(db, importador_id)
