"""API de Zarpi Maquilas (`/maquilas/*`).

Los endpoints son `def` (no `async`) a propósito: pymongo es síncrono y FastAPI
los corre en su pool de hilos, igual que hace con SQLAlchemy en el resto de la API.
"""
# Sin `from __future__ import annotations`: con el decorador del limitador,
# FastAPI no resolvería el modelo del cuerpo escrito como texto.
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from pymongo.database import Database
from sqlalchemy.orm import Session

from config import RATE_LIMIT_REGISTER
from maquilas import archivos, chat, directorio, marca_blanca, parametros, pedidos, resenas, servicio, solicitudes
from maquilas import ficha as fichas
from maquilas.db import BUCKETS, get_mongo
from utils import gridfs_archivos
from maquilas.esquemas import (
    AceptarPropuestaEntrada, AdminCrearMaquilaEntrada, ComprobanteEntrada, DocumentosEntrada, EtapaEntrada,
    FichaVistaPreviaEntrada, MensajeEntrada, MotivoEntrada, MuestraEntrada, PerfilEntrada, ProductoEntrada,
    PropuestaEntrada, RegistroMaquilaEntrada, RepetirEntrada, ReporteCalidadEntrada, ResenaEntrada,
    RespuestaCalidadEntrada, RespuestaMuestraEntrada, RespuestaResenaEntrada, SolicitudEntrada,
)
from maquilas.identidad import ROLES_CLIENTE, ROLES_EQUIPO, ROLES_MAQUILADORA, ROLES_MODULO, es_maquiladora, maquiladora_id_de
from schemas.auth import RegistroPendienteResponse
from utils.dependencies import get_db, get_optional_current_user, require_rol, require_rol_in
from utils.limiter import RATE_LIMIT_CHAT_MESSAGE, RATE_LIMIT_PUBLIC_READ, RATE_LIMIT_PUBLIC_WRITE, limiter


def _modulo_activo(db: Session = Depends(get_db)) -> None:
    """Apagado desde *Módulos*, el módulo entero responde 404 (como Liquidaciones)."""
    from services import modulos

    if not modulos.activo(db, "maquilas"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Zarpi Maquilas no está habilitado en esta instalación")


router = APIRouter(prefix="/maquilas", tags=["Maquilas"], dependencies=[Depends(_modulo_activo)])

require_maquiladora = require_rol_in(*ROLES_MAQUILADORA)
require_cliente = require_rol_in(*ROLES_CLIENTE)
require_modulo = require_rol_in(*ROLES_MODULO)
# Cliente o maquiladora: las dos partes de un pedido o de un chat.
require_parte = require_rol_in(*(ROLES_CLIENTE + ROLES_MAQUILADORA))
require_equipo = require_rol_in(*ROLES_EQUIPO)
require_admin = require_rol("admin")


# ==================== Público ====================

@router.get("/parametros")
@limiter.limit(RATE_LIMIT_PUBLIC_READ)
def ver_parametros(request: Request, mongo: Database = Depends(get_mongo)):
    """Categorías, procesos y certificaciones: los usa el formulario de registro."""
    return parametros.publicos(mongo)


@router.post("/registro", response_model=RegistroPendienteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_REGISTER)
def registrar(
    request: Request,
    datos: RegistroMaquilaEntrada,
    mongo: Database = Depends(get_mongo),
    db: Session = Depends(get_db),
):
    """Registro de una maquiladora. Después confirma el correo con
    `POST /auth/verificar-email`, como cualquier cuenta."""
    return servicio.registrar(mongo, db, datos)


@router.get("/archivos/{bucket}/{archivo_id}")
def descargar(
    bucket: str,
    archivo_id: str,
    range_: Optional[str] = Header(default=None, alias="Range"),
    mongo: Database = Depends(get_mongo),
    usuario: Optional[dict] = Depends(get_optional_current_user),
):
    fila = archivos.buscar(mongo, bucket, archivo_id) if bucket in BUCKETS else None
    if not fila or not archivos.puede_ver(mongo, fila, usuario):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")

    meta = fila.get("metadata") or {}
    tamano = int(fila.get("length", 0))
    cabeceras = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": gridfs_archivos.disposicion(meta.get("nombre_original") or "archivo"),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
    }
    tramo = archivos.rango(range_, tamano)
    if tramo:
        inicio, fin = tramo
        cabeceras["Content-Range"] = f"bytes {inicio}-{fin}/{tamano}"
        cabeceras["Content-Length"] = str(fin - inicio + 1)
        return StreamingResponse(archivos.leer_trozos(mongo, bucket, fila["_id"], inicio, fin),
                                 status_code=status.HTTP_206_PARTIAL_CONTENT,
                                 media_type=meta.get("content_type"), headers=cabeceras)
    cabeceras["Content-Length"] = str(tamano)
    return StreamingResponse(archivos.leer_trozos(mongo, bucket, fila["_id"]),
                             media_type=meta.get("content_type"), headers=cabeceras)


# ==================== La maquiladora ====================

@router.post("/archivos/{bucket}", status_code=status.HTTP_201_CREATED)
def subir_archivo(
    bucket: str,
    tipo: str = Form(...),
    archivo: UploadFile = File(...),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_parte),
):
    """La maquiladora sube su expediente, muestras y evidencias; el cliente, referencias,
    ficha técnica y comprobantes. Los dos, adjuntos del chat."""
    permitidos = archivos.TIPOS_MAQUILADORA if es_maquiladora(usuario) else archivos.TIPOS_CLIENTE
    if tipo not in permitidos or archivos.TIPOS[tipo][0] != bucket:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de archivo no admitido aquí")
    try:
        return archivos.subir(mongo, tipo=tipo, nombre_original=archivo.filename or "", contenido=archivo.file,
                              usuario=usuario)
    except archivos.ArchivoDemasiadoGrande as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc))
    except archivos.ArchivoInvalido as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/mi-maquiladora")
def mi_maquiladora(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_maquiladora)):
    return servicio.mi_maquiladora(mongo, usuario)


@router.put("/mi-maquiladora")
def actualizar_perfil(datos: PerfilEntrada, mongo: Database = Depends(get_mongo),
                      usuario: dict = Depends(require_maquiladora)):
    return servicio.actualizar_perfil(mongo, usuario, datos)


@router.put("/mi-maquiladora/documentos")
def actualizar_documentos(datos: DocumentosEntrada, mongo: Database = Depends(get_mongo),
                          usuario: dict = Depends(require_maquiladora)):
    try:
        return servicio.actualizar_documentos(mongo, usuario, datos)
    except archivos.ArchivoInvalido as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/mi-maquiladora/enviar-verificacion")
def enviar_a_verificacion(mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
                          usuario: dict = Depends(require_maquiladora)):
    return servicio.enviar_a_verificacion(mongo, db, usuario)


@router.get("/mi-maquiladora/productos")
def mis_productos(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_maquiladora)):
    return marca_blanca.mis_productos(mongo, usuario)


@router.post("/mi-maquiladora/productos", status_code=status.HTTP_201_CREATED)
def crear_producto(datos: ProductoEntrada, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_maquiladora)):
    return marca_blanca.crear(mongo, usuario, datos)


@router.put("/mi-maquiladora/productos/{producto_id}")
def actualizar_producto(producto_id: str, datos: ProductoEntrada, mongo: Database = Depends(get_mongo),
                        usuario: dict = Depends(require_maquiladora)):
    return marca_blanca.actualizar(mongo, usuario, producto_id, datos)


@router.get("/mi-maquiladora/resenas")
def mis_resenas(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_maquiladora)):
    return resenas.de_mi_maquiladora(mongo, usuario)


@router.post("/resenas/{resena_id}/respuesta")
def responder_resena(resena_id: str, datos: RespuestaResenaEntrada, mongo: Database = Depends(get_mongo),
                     db: Session = Depends(get_db), usuario: dict = Depends(require_maquiladora)):
    return resenas.responder(mongo, db, usuario, resena_id, datos.respuesta)


# ==================== Directorio (clientes) ====================

@router.get("/directorio")
def ver_directorio(
    categoria: Optional[str] = Query(None, max_length=40),
    proceso: Optional[str] = Query(None, max_length=60),
    ciudad: Optional[str] = Query(None, max_length=80),
    q: Optional[str] = Query(None, max_length=80),
    cantidad: Optional[int] = Query(None, ge=1, le=10_000_000),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_modulo),
):
    return directorio.listar(mongo, categoria=categoria, proceso=proceso, ciudad=ciudad, q=q, cantidad=cantidad)


@router.get("/directorio/{maquiladora_id}")
def ver_maquiladora_publica(maquiladora_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_modulo)):
    return directorio.perfil(mongo, maquiladora_id)


@router.get("/directorio/{maquiladora_id}/resenas")
def resenas_publicas(maquiladora_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_modulo)):
    return resenas.publicas(mongo, maquiladora_id)


# ==================== Marca blanca (clientes) ====================

@router.get("/catalogo")
def ver_catalogo(
    categoria: Optional[str] = Query(None, max_length=40),
    q: Optional[str] = Query(None, max_length=80),
    cantidad: Optional[int] = Query(None, ge=1, le=10_000_000),
    maquiladora: Optional[str] = Query(None, max_length=40),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_modulo),
):
    return marca_blanca.catalogo(mongo, categoria=categoria, q=q, cantidad=cantidad, maquiladora_id=maquiladora)


@router.get("/catalogo/{producto_id}")
def ver_producto(producto_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_modulo)):
    return marca_blanca.detalle(mongo, producto_id)


@router.post("/fichas/vista-previa")
def vista_previa_ficha(datos: FichaVistaPreviaEntrada, mongo: Database = Depends(get_mongo),
                       usuario: dict = Depends(require_cliente)):
    """El PDF de la ficha técnica guiada, para revisarlo antes de enviar la solicitud."""
    contenido = fichas.generar_pdf(mongo, fichas.limpiar(datos.ficha.model_dump()), titulo=datos.titulo.strip(),
                                   categoria=datos.categoria, cantidad=datos.cantidad)
    return Response(content=contenido, media_type="application/pdf",
                    headers={"Content-Disposition": 'inline; filename="ficha-tecnica.pdf"', "Cache-Control": "no-store"})


# ==================== Solicitudes y propuestas ====================

@router.post("/solicitudes", status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_PUBLIC_WRITE)
def crear_solicitud(request: Request, datos: SolicitudEntrada, mongo: Database = Depends(get_mongo),
                    db: Session = Depends(get_db), usuario: dict = Depends(require_cliente)):
    return solicitudes.crear(mongo, db, usuario, datos)


@router.get("/solicitudes")
def mis_solicitudes(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_cliente)):
    return solicitudes.mis_solicitudes(mongo, usuario)


@router.get("/recibidas")
def solicitudes_recibidas(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_maquiladora)):
    return solicitudes.recibidas(mongo, usuario)


@router.get("/solicitudes/{solicitud_id}")
def ver_solicitud(solicitud_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_modulo)):
    return solicitudes.detalle(mongo, usuario, solicitud_id)


@router.post("/solicitudes/{solicitud_id}/cancelar")
def cancelar_solicitud(solicitud_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
                       usuario: dict = Depends(require_cliente)):
    return solicitudes.cancelar(mongo, db, usuario, solicitud_id)


@router.post("/solicitudes/{solicitud_id}/acuerdo")
def aceptar_acuerdo(solicitud_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_maquiladora)):
    """La maquiladora acepta el acuerdo de confidencialidad y ve el detalle."""
    return solicitudes.aceptar_acuerdo(mongo, usuario, solicitud_id)


@router.post("/solicitudes/{solicitud_id}/rechazar")
def rechazar_solicitud(solicitud_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
                       db: Session = Depends(get_db), usuario: dict = Depends(require_maquiladora)):
    return solicitudes.rechazar(mongo, db, usuario, solicitud_id, datos.motivo)


@router.put("/solicitudes/{solicitud_id}/propuesta")
def guardar_propuesta(solicitud_id: str, datos: PropuestaEntrada, mongo: Database = Depends(get_mongo),
                      db: Session = Depends(get_db), usuario: dict = Depends(require_maquiladora)):
    return solicitudes.guardar_propuesta(mongo, db, usuario, solicitud_id, datos)


@router.post("/propuestas/{propuesta_id}/aceptar")
def aceptar_propuesta(propuesta_id: str, datos: AceptarPropuestaEntrada, mongo: Database = Depends(get_mongo),
                      db: Session = Depends(get_db), usuario: dict = Depends(require_cliente)):
    """El cliente elige: se cierra la solicitud y se abre el pedido."""
    return solicitudes.aceptar_propuesta(mongo, db, usuario, propuesta_id, datos)


# ==================== Pedidos ====================

@router.get("/pedidos")
def listar_pedidos(mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_parte)):
    return pedidos.listar(mongo, usuario)


@router.get("/pedidos/{pedido_id}")
def ver_pedido(pedido_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_modulo)):
    return pedidos.detalle(mongo, usuario, pedido_id)


@router.post("/pedidos/{pedido_id}/muestras")
def enviar_muestra(pedido_id: str, datos: MuestraEntrada, mongo: Database = Depends(get_mongo),
                   db: Session = Depends(get_db), usuario: dict = Depends(require_maquiladora)):
    return pedidos.enviar_muestra(mongo, db, usuario, pedido_id, datos)


@router.post("/pedidos/{pedido_id}/muestras/responder")
def responder_muestra(pedido_id: str, datos: RespuestaMuestraEntrada, mongo: Database = Depends(get_mongo),
                      db: Session = Depends(get_db), usuario: dict = Depends(require_cliente)):
    return pedidos.responder_muestra(mongo, db, usuario, pedido_id, datos)


@router.post("/pedidos/{pedido_id}/etapas/{clave}")
def completar_etapa(pedido_id: str, clave: str, datos: EtapaEntrada, mongo: Database = Depends(get_mongo),
                    db: Session = Depends(get_db), usuario: dict = Depends(require_maquiladora)):
    return pedidos.completar_etapa(mongo, db, usuario, pedido_id, clave, datos)


@router.post("/pedidos/{pedido_id}/calidad")
def enviar_reporte_calidad(pedido_id: str, datos: ReporteCalidadEntrada, mongo: Database = Depends(get_mongo),
                           db: Session = Depends(get_db), usuario: dict = Depends(require_maquiladora)):
    return pedidos.enviar_reporte_calidad(mongo, db, usuario, pedido_id, datos)


@router.post("/pedidos/{pedido_id}/calidad/responder")
def responder_calidad(pedido_id: str, datos: RespuestaCalidadEntrada, mongo: Database = Depends(get_mongo),
                      db: Session = Depends(get_db), usuario: dict = Depends(require_cliente)):
    return pedidos.responder_calidad(mongo, db, usuario, pedido_id, datos)


@router.post("/pedidos/{pedido_id}/resena", status_code=status.HTTP_201_CREATED)
def calificar_pedido(pedido_id: str, datos: ResenaEntrada, mongo: Database = Depends(get_mongo),
                     db: Session = Depends(get_db), usuario: dict = Depends(require_cliente)):
    return resenas.crear(mongo, db, usuario, pedido_id, datos)


@router.post("/pedidos/{pedido_id}/repetir", status_code=status.HTTP_201_CREATED)
def repetir_pedido(pedido_id: str, datos: RepetirEntrada, mongo: Database = Depends(get_mongo),
                   db: Session = Depends(get_db), usuario: dict = Depends(require_cliente)):
    """Crea una solicitud nueva a la misma maquila con el mismo brief."""
    return solicitudes.repetir_pedido(mongo, db, usuario, pedido_id, datos)


@router.post("/pedidos/{pedido_id}/hitos/{clave}/comprobante")
def subir_comprobante(pedido_id: str, clave: str, datos: ComprobanteEntrada, mongo: Database = Depends(get_mongo),
                      db: Session = Depends(get_db), usuario: dict = Depends(require_cliente)):
    return pedidos.subir_comprobante(mongo, db, usuario, pedido_id, clave, datos)


@router.post("/pedidos/{pedido_id}/hitos/{clave}/confirmar")
def confirmar_pago(pedido_id: str, clave: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
                   usuario: dict = Depends(require_maquiladora)):
    return pedidos.revisar_comprobante(mongo, db, usuario, pedido_id, clave, confirmado=True)


@router.post("/pedidos/{pedido_id}/hitos/{clave}/rechazar")
def rechazar_pago(pedido_id: str, clave: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
                  db: Session = Depends(get_db), usuario: dict = Depends(require_maquiladora)):
    return pedidos.revisar_comprobante(mongo, db, usuario, pedido_id, clave, confirmado=False, motivo=datos.motivo)


@router.post("/pedidos/{pedido_id}/recibido")
def marcar_recibido(pedido_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
                    usuario: dict = Depends(require_cliente)):
    return pedidos.marcar_recibido(mongo, db, usuario, pedido_id)


@router.post("/pedidos/{pedido_id}/cancelar")
def cancelar_pedido(pedido_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
                    db: Session = Depends(get_db), usuario: dict = Depends(require_parte)):
    return pedidos.cancelar(mongo, db, usuario, pedido_id, datos.motivo)


# ==================== Chat ====================

def _nombre_para_chat(mongo: Database, db: Session, usuario: dict) -> str:
    if es_maquiladora(usuario):
        doc = mongo.maquiladoras.find_one({"_id": maquiladora_id_de(mongo, usuario)}, {"nombre_comercial": 1}) or {}
        return doc.get("nombre_comercial") or "Maquila"
    from models.usuario import Usuario

    fila = db.query(Usuario.nombre, Usuario.apellido, Usuario.email).filter(Usuario.id == usuario["user_id"]).first()
    return (" ".join(x for x in (fila[0], fila[1]) if x) or fila[2]) if fila else "Cliente"


@router.get("/hilos/{hilo}/mensajes")
def leer_mensajes(hilo: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_modulo)):
    return chat.listar(mongo, hilo, usuario)


@router.post("/hilos/{hilo}/mensajes", status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE_LIMIT_CHAT_MESSAGE)
def enviar_mensaje(request: Request, hilo: str, datos: MensajeEntrada, mongo: Database = Depends(get_mongo),
                   db: Session = Depends(get_db), usuario: dict = Depends(require_parte)):
    return chat.enviar(mongo, db, hilo, usuario, datos, _nombre_para_chat(mongo, db, usuario))


# ==================== Equipo Zarpi ====================

@router.post("/admin/maquiladoras", status_code=status.HTTP_201_CREATED)
def crear_maquiladora(datos: AdminCrearMaquilaEntrada, mongo: Database = Depends(get_mongo),
                      db: Session = Depends(get_db), usuario: dict = Depends(require_admin)):
    """Alta desde Admin › Usuarios (el panel puede crear cualquier tipo de cuenta)."""
    return servicio.crear_por_equipo(mongo, db, usuario, datos)


@router.get("/admin/maquiladoras")
def listar_maquiladoras(
    estado: Optional[str] = Query(None, max_length=20),
    q: Optional[str] = Query(None, max_length=80),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_equipo),
):
    return servicio.listar_para_equipo(mongo, estado=estado, q=q)


@router.get("/admin/maquiladoras/{maquiladora_id}")
def ver_maquiladora(maquiladora_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_equipo)):
    return servicio.detalle_para_equipo(mongo, maquiladora_id)


@router.post("/admin/maquiladoras/{maquiladora_id}/aprobar")
def aprobar(maquiladora_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
            usuario: dict = Depends(require_equipo)):
    return servicio.aprobar(mongo, db, usuario, maquiladora_id)


@router.post("/admin/maquiladoras/{maquiladora_id}/rechazar")
def rechazar(maquiladora_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
             db: Session = Depends(get_db), usuario: dict = Depends(require_equipo)):
    return servicio.rechazar(mongo, db, usuario, maquiladora_id, datos.motivo)


@router.post("/admin/maquiladoras/{maquiladora_id}/suspender")
def suspender(maquiladora_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
              db: Session = Depends(get_db), usuario: dict = Depends(require_admin)):
    return servicio.suspender(mongo, db, usuario, maquiladora_id, datos.motivo)


@router.post("/admin/maquiladoras/{maquiladora_id}/reactivar")
def reactivar(maquiladora_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
              usuario: dict = Depends(require_admin)):
    return servicio.reactivar(mongo, db, usuario, maquiladora_id)


@router.get("/admin/productos")
def listar_productos(
    q: Optional[str] = Query(None, max_length=80),
    ocultos: Optional[bool] = Query(None),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_equipo),
):
    return marca_blanca.listar_para_equipo(mongo, q=q, ocultos=ocultos)


@router.post("/admin/productos/{producto_id}/ocultar")
def ocultar_producto(producto_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
                     db: Session = Depends(get_db), usuario: dict = Depends(require_equipo)):
    return marca_blanca.ocultar(mongo, db, usuario, producto_id, datos.motivo)


@router.post("/admin/productos/{producto_id}/mostrar")
def mostrar_producto(producto_id: str, mongo: Database = Depends(get_mongo), db: Session = Depends(get_db),
                     usuario: dict = Depends(require_equipo)):
    return marca_blanca.ocultar(mongo, db, usuario, producto_id, None)


@router.get("/admin/resenas")
def listar_resenas(
    ocultas: Optional[bool] = Query(None),
    maximo: Optional[int] = Query(None, ge=1, le=5),
    mongo: Database = Depends(get_mongo),
    usuario: dict = Depends(require_equipo),
):
    return resenas.listar_para_equipo(mongo, ocultas=ocultas, maximo=maximo)


@router.post("/admin/resenas/{resena_id}/ocultar")
def ocultar_resena(resena_id: str, datos: MotivoEntrada, mongo: Database = Depends(get_mongo),
                   usuario: dict = Depends(require_equipo)):
    return resenas.moderar(mongo, usuario, resena_id, datos.motivo)


@router.post("/admin/resenas/{resena_id}/mostrar")
def mostrar_resena(resena_id: str, mongo: Database = Depends(get_mongo), usuario: dict = Depends(require_equipo)):
    return resenas.moderar(mongo, usuario, resena_id, None)
