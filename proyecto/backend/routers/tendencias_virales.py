"""Tendencias v2: envío de enlaces, panel del aprobador, feed y ficha públicos."""
from datetime import date
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models.tendencias_virales import EstadoTendencia
from models.usuario import Usuario
from services import tendencias_virales as svc
from services.tendencias import puede_curar, puede_disenar
from utils.dependencies import get_current_user, get_db
from utils.limiter import RATE_LIMIT_TENDENCIAS_ENVIO, limiter

router = APIRouter(prefix="/tendencias", tags=["Tendencias"])

Motivo = Literal["marca_replica", "repetido", "no_es_producto", "regulado_inviable", "calidad"]


class EnvioEnlace(BaseModel):
    url: str = Field(..., min_length=5, max_length=1000)
    nombre: Optional[str] = Field(None, max_length=120)
    categoria: Optional[str] = Field(None, max_length=100)
    nota: Optional[str] = Field(None, max_length=500)
    # Solo para importadoras: su foto del producto como portada propuesta.
    portada_url: Optional[str] = Field(None, max_length=500)


class EdicionFicha(BaseModel):
    nombre: Optional[str] = Field(None, max_length=120)
    categoria: Optional[str] = Field(None, max_length=100)
    regulado: Optional[bool] = None
    por_que_tendencia: Optional[str] = Field(None, max_length=200)
    ojo_antes: Optional[str] = Field(None, max_length=200)
    portada_url: Optional[str] = Field(None, max_length=500)
    # Solo Instagram (V1): el código de inserción oficial que pega el aprobador.
    embed_html: Optional[str] = Field(None, max_length=20000)


class Aprobacion(BaseModel):
    # Por defecto el producto pasa a diseño. `publicar` es el respaldo del
    # admin cuando el producto ya tiene portada.
    publicar: bool = False


class Diseno(BaseModel):
    portada_url: Optional[str] = Field(None, max_length=500)
    imagenes: Optional[List[str]] = Field(None, max_length=8)


class Rechazo(BaseModel):
    motivo: Motivo


def _usuario(db: Session, current_user: dict) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if usuario is None or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return usuario


def usuario_actual(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> Usuario:
    return _usuario(db, current_user)


def aprobador(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
    if not puede_curar(usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el equipo aprobador puede hacer esto")
    return usuario


def disenador(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
    if not puede_disenar(usuario):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el equipo de diseño puede hacer esto")
    return usuario


# ── Envío (cualquier usuario registrado) ─────────────────────────────────────

@router.post("/enviar")
@limiter.limit(RATE_LIMIT_TENDENCIAS_ENVIO)
def enviar(request: Request, datos: EnvioEnlace, db: Session = Depends(get_db),
           usuario: Usuario = Depends(usuario_actual)):
    """Pega un enlace de TikTok, Instagram o YouTube. Respuesta inmediata:
    recibido, repetido o no válido (422)."""
    return svc.enviar(db, usuario, url=datos.url, nombre=datos.nombre, categoria=datos.categoria,
                      nota=datos.nota, portada_url=datos.portada_url)


@router.get("/mis-envios")
def mis_envios(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    from models.tendencias_virales import TendenciaItem

    items = (
        db.query(TendenciaItem).filter(TendenciaItem.enviado_por == usuario.id)
        .order_by(TendenciaItem.fecha_creacion.desc()).limit(100).all()
    )
    return [
        {
            "id": i.id, "url": i.url_origen, "plataforma": i.plataforma, "nombre": i.nombre,
            "estado": i.estado, "motivo_rechazo": svc.MOTIVOS_RECHAZO.get(i.motivo_rechazo) if i.motivo_rechazo else None,
            "fecha_envio": i.fecha_creacion.isoformat() + "Z",
        }
        for i in items
    ]


# ── Panel del aprobador ──────────────────────────────────────────────────────

@router.get("/aprobacion/cola")
def cola(estado: Literal["pendiente", "en_diseno"] = "pendiente",
         db: Session = Depends(get_db), usuario: Usuario = Depends(aprobador)):
    """Pendientes (o en diseño), los más antiguos primero."""
    return [svc.para_aprobador(db, i) for i in svc.cola(db, estado)]


@router.get("/aprobacion/contadores")
def contadores(db: Session = Depends(get_db), usuario: Usuario = Depends(aprobador)):
    return svc.contadores(db)


@router.get("/aprobacion/motivos")
def motivos(usuario: Usuario = Depends(aprobador)):
    return [{"valor": k, "texto": v} for k, v in svc.MOTIVOS_RECHAZO.items()]


@router.get("/aprobacion/publicados")
def publicados(db: Session = Depends(get_db), usuario: Usuario = Depends(aprobador)):
    from models.tendencias_virales import TendenciaItem

    items = (
        db.query(TendenciaItem)
        .filter(TendenciaItem.estado.in_((EstadoTendencia.publicado.value, EstadoTendencia.caido.value)))
        .order_by(TendenciaItem.publicado_en.desc()).limit(200).all()
    )
    return [svc.para_aprobador(db, i) for i in items]


@router.patch("/items/{item_id}")
def editar(item_id: str, datos: EdicionFicha, db: Session = Depends(get_db), usuario: Usuario = Depends(aprobador)):
    item = svc.item_o_404(db, item_id)
    if item.estado in (EstadoTendencia.rechazado.value, EstadoTendencia.duplicado.value):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este producto fue rechazado")
    svc.editar(db, item, usuario, datos.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(item)
    return svc.para_aprobador(db, item)


@router.post("/items/{item_id}/aprobar")
def aprobar(item_id: str, datos: Aprobacion, db: Session = Depends(get_db), usuario: Usuario = Depends(aprobador)):
    item = svc.item_o_404(db, item_id)
    svc.aprobar(db, item, usuario, publicar=datos.publicar)
    db.commit()
    db.refresh(item)
    return svc.para_aprobador(db, item)


@router.post("/items/{item_id}/rechazar")
def rechazar(item_id: str, datos: Rechazo, db: Session = Depends(get_db), usuario: Usuario = Depends(aprobador)):
    item = svc.item_o_404(db, item_id)
    svc.rechazar(db, item, usuario, datos.motivo)
    db.commit()
    db.refresh(item)
    return svc.para_aprobador(db, item)


@router.post("/items/{item_id}/archivar")
def archivar(item_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(aprobador)):
    """Saca del feed un producto publicado."""
    item = svc.item_o_404(db, item_id)
    if item.estado not in (EstadoTendencia.publicado.value, EstadoTendencia.caido.value):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se archiva un producto publicado")
    item.estado = EstadoTendencia.archivado.value
    db.commit()
    return svc.para_aprobador(db, item)


# ── Diseño ───────────────────────────────────────────────────────────────────
# El designer pone portada e imágenes con la identidad de Zarpi a lo aprobado y
# lo publica. No aprueba ni rechaza: eso es del equipo aprobador.

@router.get("/diseno/cola")
def cola_diseno(db: Session = Depends(get_db), usuario: Usuario = Depends(disenador)):
    return [svc.para_disenador(db, i) for i in svc.cola_diseno(db)]


@router.get("/diseno/contadores")
def contadores_diseno(db: Session = Depends(get_db), usuario: Usuario = Depends(disenador)):
    return svc.contadores_diseno(db, usuario)


@router.get("/diseno/publicados")
def publicados_diseno(
    filtro: Literal["todos", "sin_diseno", "mios"] = "todos",
    q: Optional[str] = Query(None, max_length=120),
    mios: bool = False,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(disenador),
):
    """Todo lo publicado, para que diseño lo retoque si no tiene la identidad
    de Zarpi. `filtro=sin_diseno`: lo que diseño no ha revisado; `mios`: lo que
    diseñó quien pregunta. `q` busca por nombre."""
    if mios:
        filtro = "mios"
    return [svc.para_disenador(db, i) for i in svc.publicados_diseno(db, usuario, filtro, q)]


@router.patch("/diseno/items/{item_id}")
def guardar_diseno(item_id: str, datos: Diseno, db: Session = Depends(get_db), usuario: Usuario = Depends(disenador)):
    item = svc.item_o_404(db, item_id)
    svc.disenar(db, item, usuario, datos.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(item)
    return svc.para_disenador(db, item)


@router.post("/diseno/items/{item_id}/revisado")
def marcar_revisado(item_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(disenador)):
    """Lo publicado ya tiene la identidad de Zarpi y no hace falta cambiarle nada."""
    item = svc.item_o_404(db, item_id)
    svc.marcar_disenado(item, usuario)
    db.commit()
    db.refresh(item)
    return svc.para_disenador(db, item)


@router.post("/diseno/items/{item_id}/publicar")
def publicar_diseno(item_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(disenador)):
    item = svc.item_o_404(db, item_id)
    svc.publicar_diseno(db, item, usuario)
    db.commit()
    db.refresh(item)
    return svc.para_disenador(db, item)


# ── Público ──────────────────────────────────────────────────────────────────

@router.get("/feed")
def feed(
    semana: Optional[date] = None,
    categoria: Optional[str] = Query(None, max_length=100),
    importador_id: Optional[str] = Query(None, max_length=36),
    db: Session = Depends(get_db),
):
    """Productos publicados de la semana (la actual por defecto). Sin código de
    inserción: el feed solo muestra portadas."""
    return svc.feed(db, semana=semana, categoria=categoria, importador_id=importador_id)


@router.get("/items/{item_id}")
def ficha(item_id: str, db: Session = Depends(get_db)):
    item = svc.item_o_404(db, item_id)
    if item.estado != EstadoTendencia.publicado.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return svc.ficha(db, item)
