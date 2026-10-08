"""Catálogos selectos de las empresas importadoras. Ver models/catalogo.py."""
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from models.catalogo import AccesoCatalogo, CatalogoEmpresa, CriterioCatalogo, ProductoCatalogo
from models.importador import Importador
from models.usuario import ORDEN_TIERS_COTIZANTE, Usuario
from services import catalogos as svc
from utils.dependencies import get_current_user, get_db

router = APIRouter(prefix="/catalogos", tags=["Catálogos de empresas"])

Criterio = Literal["manual", "tier_minimo", "clientes_con_orden", "suscriptores_zarpi"]


class CatalogoDatos(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=80)
    descripcion: Optional[str] = Field(None, max_length=300)
    criterio: Criterio = "manual"
    tier_minimo: Optional[str] = None
    activo: bool = True

    @model_validator(mode="after")
    def tier_si_aplica(self):
        if self.criterio == CriterioCatalogo.tier_minimo.value:
            if self.tier_minimo not in ORDEN_TIERS_COTIZANTE:
                raise ValueError("Elige el nivel mínimo de cotizante: Bronze, Silver, Gold o Élite")
        else:
            self.tier_minimo = None
        return self


class ProductoDatos(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=120)
    descripcion: Optional[str] = None
    fotos: List[str] = Field(default_factory=list, max_length=svc.MAX_FOTOS_POR_PRODUCTO)
    linea_producto: Optional[str] = Field(None, max_length=100)
    pais_origen: str = Field("China", min_length=1, max_length=100)
    cantidad_minima: Optional[float] = Field(None, gt=0)
    unidad_cantidad: Literal["unidades", "m3"] = "unidades"
    tiempo_estimado: Optional[str] = Field(None, max_length=80)
    que_pedir_en_cotizacion: Optional[str] = None
    orden: int = 0
    activo: bool = True

    @field_validator("fotos")
    @classmethod
    def fotos_limpias(cls, v: List[str]) -> List[str]:
        fotos: List[str] = []
        for url in v:
            url = (url or "").strip()
            if url and url not in fotos:
                fotos.append(url)
        return fotos


class AccesoManual(BaseModel):
    usuario_id: str


# ── Dependencias y serialización ─────────────────────────────────────────────

def _usuario(db: Session, current_user: dict) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    if usuario is None or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return usuario


def usuario_actual(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> Usuario:
    return _usuario(db, current_user)


def de_empresa(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
    if usuario.rol not in ("importador", "asesor") or not usuario.importador_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo para empresas importadoras")
    return usuario


def dueno(usuario: Usuario = Depends(de_empresa)) -> Usuario:
    if usuario.rol != "importador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Solo la cuenta de la empresa administra sus catálogos")
    return usuario


def _catalogo_propio(db: Session, catalogo_id: str, usuario: Usuario) -> CatalogoEmpresa:
    catalogo = db.query(CatalogoEmpresa).filter(
        CatalogoEmpresa.id == catalogo_id, CatalogoEmpresa.importador_id == usuario.importador_id).first()
    if catalogo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catálogo no encontrado")
    return catalogo


def _producto_dict(p: ProductoCatalogo) -> dict:
    return {
        "id": p.id, "catalogo_id": p.catalogo_id, "nombre": p.nombre, "descripcion": p.descripcion,
        "fotos": list(p.fotos or []), "linea_producto": p.linea_producto, "pais_origen": p.pais_origen,
        "cantidad_minima": p.cantidad_minima, "unidad_cantidad": p.unidad_cantidad,
        "tiempo_estimado": p.tiempo_estimado, "que_pedir_en_cotizacion": p.que_pedir_en_cotizacion,
        "orden": p.orden, "activo": p.activo,
    }


def _catalogo_dict(c: CatalogoEmpresa, productos: List[ProductoCatalogo], importador: Optional[Importador] = None,
                   accesos_manuales: Optional[int] = None) -> dict:
    datos = {
        "id": c.id, "importador_id": c.importador_id, "titulo": c.titulo, "descripcion": c.descripcion,
        "criterio": c.criterio, "criterio_texto": svc.describir_criterio(c), "tier_minimo": c.tier_minimo,
        "activo": c.activo, "productos": [_producto_dict(p) for p in productos],
        "total_productos": len([p for p in productos if p.activo]),
        "fecha_actualizacion": c.fecha_actualizacion.isoformat() + "Z",
    }
    if importador is not None:
        datos["empresa"] = {"id": importador.id, "nombre": importador.nombre_empresa,
                            "logo_url": importador.logo_url, "verificado": bool(importador.verificado)}
    if accesos_manuales is not None:
        datos["accesos_manuales"] = accesos_manuales
    return datos


# ── Comprador ────────────────────────────────────────────────────────────────

@router.get("/disponibles")
def disponibles(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    """Catálogos que las empresas le desbloquearon a este comprador."""
    if usuario.rol != "solicitante":
        return []
    disponibles = svc.catalogos_disponibles(db, usuario)
    catalogos = [c for c, _ in disponibles]
    productos = svc.productos_activos(db, (c.id for c in catalogos))
    empresas = {
        i.id: i for i in db.query(Importador).filter(
            Importador.id.in_({c.importador_id for c in catalogos}), Importador.estado == "activo").all()
    } if catalogos else {}
    return [
        {**_catalogo_dict(c, productos.get(c.id, []), empresas[c.importador_id]), "acceso_por": acceso_por}
        for c, acceso_por in disponibles if c.importador_id in empresas
    ]


@router.get("/ver/{catalogo_id}")
def ver(catalogo_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    catalogo = db.query(CatalogoEmpresa).filter(CatalogoEmpresa.id == catalogo_id).first()
    if catalogo is None or not svc.puede_ver(db, usuario, catalogo):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catálogo no disponible")
    empresa = db.query(Importador).filter(Importador.id == catalogo.importador_id).first()
    productos = svc.productos_activos(db, [catalogo.id])[catalogo.id]
    return _catalogo_dict(catalogo, productos, empresa)


# ── Empresa ──────────────────────────────────────────────────────────────────

@router.get("/mios")
def mis_catalogos(db: Session = Depends(get_db), usuario: Usuario = Depends(de_empresa)):
    catalogos = (
        db.query(CatalogoEmpresa)
        .filter(CatalogoEmpresa.importador_id == usuario.importador_id)
        .order_by(CatalogoEmpresa.fecha_creacion.asc())
        .all()
    )
    ids = [c.id for c in catalogos]
    productos = {i: [] for i in ids}
    if ids:
        for p in (db.query(ProductoCatalogo).filter(ProductoCatalogo.catalogo_id.in_(ids))
                  .order_by(ProductoCatalogo.orden.asc(), ProductoCatalogo.fecha_creacion.asc()).all()):
            productos[p.catalogo_id].append(p)
    manuales = {}
    if ids:
        for (catalogo_id,) in db.query(AccesoCatalogo.catalogo_id).filter(AccesoCatalogo.catalogo_id.in_(ids)).all():
            manuales[catalogo_id] = manuales.get(catalogo_id, 0) + 1
    return [_catalogo_dict(c, productos[c.id], accesos_manuales=manuales.get(c.id, 0)) for c in catalogos]


@router.post("", status_code=status.HTTP_201_CREATED)
def crear(datos: CatalogoDatos, db: Session = Depends(get_db), usuario: Usuario = Depends(dueno)):
    catalogo = CatalogoEmpresa(importador_id=usuario.importador_id, **datos.model_dump())
    db.add(catalogo)
    db.commit()
    return _catalogo_dict(catalogo, [], accesos_manuales=0)


@router.put("/{catalogo_id}")
def editar(catalogo_id: str, datos: CatalogoDatos, db: Session = Depends(get_db), usuario: Usuario = Depends(dueno)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    for campo, valor in datos.model_dump().items():
        setattr(catalogo, campo, valor)
    catalogo.fecha_actualizacion = datetime.utcnow()
    db.commit()
    productos = db.query(ProductoCatalogo).filter(ProductoCatalogo.catalogo_id == catalogo.id).order_by(ProductoCatalogo.orden).all()
    manuales = db.query(AccesoCatalogo).filter(AccesoCatalogo.catalogo_id == catalogo.id).count()
    return _catalogo_dict(catalogo, productos, accesos_manuales=manuales)


@router.delete("/{catalogo_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(catalogo_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(dueno)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    db.query(AccesoCatalogo).filter(AccesoCatalogo.catalogo_id == catalogo.id).delete(synchronize_session=False)
    db.query(ProductoCatalogo).filter(ProductoCatalogo.catalogo_id == catalogo.id).delete(synchronize_session=False)
    db.delete(catalogo)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{catalogo_id}/productos", status_code=status.HTTP_201_CREATED)
def agregar_producto(catalogo_id: str, datos: ProductoDatos, db: Session = Depends(get_db),
                     usuario: Usuario = Depends(dueno)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    producto = ProductoCatalogo(catalogo_id=catalogo.id, **datos.model_dump())
    db.add(producto)
    catalogo.fecha_actualizacion = datetime.utcnow()
    db.commit()
    return _producto_dict(producto)


@router.put("/{catalogo_id}/productos/{producto_id}")
def editar_producto(catalogo_id: str, producto_id: str, datos: ProductoDatos, db: Session = Depends(get_db),
                    usuario: Usuario = Depends(dueno)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    producto = db.query(ProductoCatalogo).filter(
        ProductoCatalogo.id == producto_id, ProductoCatalogo.catalogo_id == catalogo.id).first()
    if producto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    for campo, valor in datos.model_dump().items():
        setattr(producto, campo, valor)
    producto.fecha_actualizacion = catalogo.fecha_actualizacion = datetime.utcnow()
    db.commit()
    return _producto_dict(producto)


@router.delete("/{catalogo_id}/productos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_producto(catalogo_id: str, producto_id: str, db: Session = Depends(get_db),
                    usuario: Usuario = Depends(dueno)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    db.query(ProductoCatalogo).filter(
        ProductoCatalogo.id == producto_id, ProductoCatalogo.catalogo_id == catalogo.id,
    ).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/clientes")
def clientes(
    q: Optional[str] = Query(None, max_length=120, description="Parte del nombre o del correo"),
    limite: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(de_empresa),
):
    """Compradores que ya tuvieron trato con la empresa, entre quienes puede
    elegir a quién le desbloquea un catálogo.

    Con `q` filtra por nombre o correo. El correo se busca completo pero solo se
    devuelve enmascarado (`email_parcial`): la empresa puede encontrar al cliente
    que recuerda por su correo sin que la lista le revele el de los demás."""
    from utils.busqueda_usuarios import coincide, enmascarar_correo, prioridad

    filas = svc.clientes_de_empresa(db, usuario.importador_id)
    if q and q.strip():
        filas = [c for c in filas if coincide(q, (c["nombre"], c["_email"]))]
        filas.sort(key=lambda c: prioridad(q, c["_email"], c["nombre"]))
    return [
        {**{k: v for k, v in c.items() if k != "_email"}, "email_parcial": enmascarar_correo(c["_email"])}
        for c in filas[:limite]
    ]


@router.get("/{catalogo_id}/accesos")
def accesos(catalogo_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(de_empresa)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    filas = (
        db.query(AccesoCatalogo, Usuario)
        .join(Usuario, Usuario.id == AccesoCatalogo.usuario_id)
        .filter(AccesoCatalogo.catalogo_id == catalogo.id)
        .order_by(AccesoCatalogo.fecha.desc())
        .all()
    )
    return [
        {"usuario_id": u.id, "nombre": " ".join(x for x in (u.nombre, u.apellido) if x) or u.email.split("@")[0],
         "tier": u.tier, "fecha": a.fecha.isoformat() + "Z"}
        for a, u in filas
    ]


@router.post("/{catalogo_id}/accesos", status_code=status.HTTP_201_CREATED)
def dar_acceso(catalogo_id: str, datos: AccesoManual, db: Session = Depends(get_db),
               usuario: Usuario = Depends(dueno)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    # Solo a compradores que ya tuvieron trato con la empresa: así no puede
    # recorrer la base de usuarios de la plataforma.
    if not svc.es_cliente_de_empresa(db, usuario.importador_id, datos.usuario_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Solo puedes dar acceso a compradores que ya cotizaron con tu empresa")
    existe = db.query(AccesoCatalogo).filter(
        AccesoCatalogo.catalogo_id == catalogo.id, AccesoCatalogo.usuario_id == datos.usuario_id).first()
    if existe is None:
        db.add(AccesoCatalogo(catalogo_id=catalogo.id, usuario_id=datos.usuario_id, otorgado_por=usuario.id))
        empresa = db.query(Importador).filter(Importador.id == catalogo.importador_id).first()
        from services.notificacion_service import notificar

        notificar(
            db, usuario_id=datos.usuario_id, tipo="catalogo",
            titulo=f"{empresa.nombre_empresa if empresa else 'Una empresa'} te abrió su catálogo",
            mensaje=f"Ya puedes ver «{catalogo.titulo}» y pedir propuesta de sus productos.",
            data={"catalogo_id": catalogo.id},
            enlace_relativo="/catalogos", whatsapp=False,
        )
        db.commit()
    return {"usuario_id": datos.usuario_id}


@router.delete("/{catalogo_id}/accesos/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_acceso(catalogo_id: str, usuario_id: str, db: Session = Depends(get_db),
                  usuario: Usuario = Depends(dueno)):
    catalogo = _catalogo_propio(db, catalogo_id, usuario)
    db.query(AccesoCatalogo).filter(
        AccesoCatalogo.catalogo_id == catalogo.id, AccesoCatalogo.usuario_id == usuario_id,
    ).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
