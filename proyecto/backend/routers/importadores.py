import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional
from uuid import UUID
import json

import config
from schemas.importador import TIERS_EMPRESA, ImportadorResponse, ImportadorUpdate
from schemas.usuario import (
    AsesorCreate,
    AsesorResponse,
    AsesorEstadoUpdate,
    AsesorEstadoResponse,
    AsignarAsesorRequest,
    ReasignacionResponse,
)
from schemas.campo_personalizado import (
    CampoPersonalizadoCreate, CampoPersonalizadoUpdate, CampoPersonalizadoResponse,
    FormularioImportadorResponse
)
from schemas.features import EvidenciaImportadorCreate, EvidenciaImportadorResponse
from schemas.metricas_empresa import MetricasImportadorResponse
from models.importador import Importador
from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.campo_personalizado import CampoPersonalizado
from models.orden import EstadoOrden, Orden
from services.certificacion_service import (
    adjuntar_certificaciones,
    subconsulta_puntaje_publicidad,
)
from utils.dependencies import get_db, require_rol, require_rol_in, get_current_user
from utils.security import hash_password
from utils.limiter import limiter, RATE_LIMIT_PUBLIC_READ
from utils.query_safety import clamp_str

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/importadores", tags=["Importadores"])

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite
    
    En MySQL usa json_contains. En SQLite usa LIKE porque no tiene json_contains.
    """
    # Usar LIKE para buscar el valor dentro del JSON (compatible con ambos)
    return column.like(f'%"{value}"%')

@router.get("", response_model=List[ImportadorResponse])
@limiter.limit(RATE_LIMIT_PUBLIC_READ)
async def listar_importadores(
    request: Request,
    especialidad: Optional[str] = Query(None, description="Filtrar por especialidad de producto"),
    pais: Optional[str] = Query(None, description="Filtrar por país de origen"),
    orden: Optional[str] = Query(None, description="'calificacion' o 'reciente'"),
    certificado: Optional[bool] = Query(None, description="Filtrar por empresas verificadas (true/false)"),
    limit: int = Query(50, ge=1, le=200, description="Máximo de filas (paginación anti-DoS)"),
    offset: int = Query(0, ge=0, le=10_000),
    db: Session = Depends(get_db)
):
    """
    Lista importadores activos con filtros y paginación (default 50, max 200).
    
    - **especialidad**: Filtrar por especialidad de producto (ej: "Textiles")
    - **pais**: Filtrar por país de origen (ej: "China")
    - **orden**: 'calificacion' (mejor calificados primero) o 'reciente' (más nuevos primero)
    - **certificado**: `true` para solo empresas verificadas, `false` para no verificadas
    """
    query = db.query(Importador).filter(Importador.estado == "activo")
    
    especialidad = clamp_str(especialidad, 80)
    pais = clamp_str(pais, 80)

    if especialidad:
        # Buscar en JSON usando LIKE (compatible con MySQL y SQLite)
        query = query.filter(json_contains_column(Importador.especialidad_producto, especialidad))
    
    if pais:
        query = query.filter(json_contains_column(Importador.paises_origen, pais))

    if certificado is not None:
        query = query.filter(Importador.verificado == certificado)

    # El orden por defecto lo decide el peso de las certificaciones que la
    # plataforma otorgó: es el "algoritmo de publicidad" del catálogo. Se hace
    # con un outerjoin para que las empresas sin sello sigan apareciendo (con 0).
    puntajes = subconsulta_puntaje_publicidad(db)
    query = query.outerjoin(puntajes, puntajes.c.importador_id == Importador.id)
    puntaje_col = func.coalesce(puntajes.c.puntaje, 0.0)

    if orden == "reciente":
        query = query.order_by(Importador.fecha_registro.desc())
    elif orden == "calificacion":
        query = query.order_by(Importador.calificacion_promedio.desc())
    else:
        # Desempate estable: a igual peso, primero la empresa verificada y luego
        # la más antigua, para que el orden no baile entre peticiones.
        query = query.order_by(
            puntaje_col.desc(),
            Importador.verificado.desc(),
            Importador.fecha_registro.asc(),
        )

    filas = query.offset(offset).limit(limit).all()
    return _con_certificaciones(db, filas)


def _con_certificaciones(db: Session, importadores: List[Importador]) -> List[ImportadorResponse]:
    """Adjunta a cada empresa sus sellos vigentes y su puntaje agregado."""
    return adjuntar_certificaciones(db, importadores)


def _una_con_certificaciones(db: Session, importador: Importador) -> ImportadorResponse:
    return _con_certificaciones(db, [importador])[0]

# ==================== Panel de empresa: asesores (Fase 1) ====================
# NOTA: estas rutas de un solo segmento literal ("/asesores", "/campos-personalizados")
# deben registrarse ANTES de "/{importador_id}" para que FastAPI no las capture como
# si "asesores"/"campos-personalizados" fueran un importador_id.

@router.post("/asesores", response_model=AsesorResponse, status_code=status.HTTP_201_CREATED)
async def crear_asesor(
    datos: AsesorCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Crea una cuenta de asesor para la empresa del usuario autenticado (solo la
    cuenta dueña puede crear asesores). El asesor solo podrá ver cuántas
    cotizaciones tiene asignadas y negociar por chat.
    """
    importador_id_str = current_user.get("importador_id")
    if not importador_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no está asociada a ninguna empresa importadora"
        )

    usuario_existente = db.query(Usuario).filter(Usuario.email == datos.email).first()
    if usuario_existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado")

    from uuid import uuid4
    nuevo_asesor = Usuario(
        id=str(uuid4()),
        email=datos.email,
        password_hash=hash_password(datos.password),
        rol="asesor",
        importador_id=importador_id_str,
        nombre=datos.nombre,
        telefono=datos.telefono,
        activo=True,
        email_verificado=True,
        perfil_completo=bool(datos.nombre)
    )
    db.add(nuevo_asesor)
    db.commit()
    db.refresh(nuevo_asesor)

    return nuevo_asesor

@router.get("/asesores", response_model=List[AsesorResponse])
async def listar_asesores(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """Lista los asesores de la empresa del usuario autenticado (solo la cuenta dueña)."""
    importador_id_str = current_user.get("importador_id")
    asesores = db.query(Usuario).filter(
        Usuario.importador_id == importador_id_str,
        Usuario.rol == "asesor"
    ).order_by(Usuario.fecha_creacion.desc()).all()

    return asesores

def _cuenta_duena(db: Session, importador_id: str) -> Optional[Usuario]:
    """Cuenta dueña de la empresa: el destino por defecto de toda reasignación."""
    return db.query(Usuario).filter(
        Usuario.importador_id == importador_id,
        Usuario.rol == "importador",
    ).order_by(Usuario.fecha_creacion.asc()).first()


def _traspasar_carga_de_trabajo(
    db: Session,
    *,
    desde_usuario_id: str,
    hacia_usuario: Usuario,
    motivo: str,
    solo_cotizacion_id: Optional[str] = None,
) -> dict:
    """Mueve cotizaciones, órdenes y conversaciones de una cuenta a otra.

    Sin esto, desactivar a un asesor dejaba sus chats apuntando a una cuenta que
    ya no puede iniciar sesión: la conversación desaparecía de la bandeja de la
    empresa y ni siquiera el dueño podía leerla, porque el control de acceso
    exige ser exactamente `importador_usuario_id`.
    """
    from models.chat import ConversacionChat, MensajeChat, TipoMensajeChat
    from uuid import uuid4

    hacia_id = str(hacia_usuario.id)

    if solo_cotizacion_id:
        # Reasignación puntual: solo esa cotización y su conversación.
        cotizaciones = 0
        ordenes = db.query(Orden).filter(
            Orden.asesor_asignado_id == desde_usuario_id,
            Orden.cotizacion_id == solo_cotizacion_id,
        ).update({Orden.asesor_asignado_id: hacia_id}, synchronize_session=False)
        conversaciones = db.query(ConversacionChat).filter(
            ConversacionChat.importador_usuario_id == desde_usuario_id,
            ConversacionChat.cotizacion_id == solo_cotizacion_id,
        ).all()
    else:
        cotizaciones = db.query(Cotizacion).filter(
            Cotizacion.asesor_asignado_id == desde_usuario_id
        ).update({Cotizacion.asesor_asignado_id: hacia_id}, synchronize_session=False)

        ordenes = db.query(Orden).filter(
            Orden.asesor_asignado_id == desde_usuario_id
        ).update({Orden.asesor_asignado_id: hacia_id}, synchronize_session=False)

        conversaciones = db.query(ConversacionChat).filter(
            ConversacionChat.importador_usuario_id == desde_usuario_id
        ).all()

    for conversacion in conversaciones:
        conversacion.importador_usuario_id = hacia_id
        # Traza visible para el solicitante: el interlocutor cambió a mitad de
        # la negociación y debe saberlo.
        db.add(MensajeChat(
            id=str(uuid4()),
            conversacion_id=conversacion.id,
            remitente_id=hacia_id,
            contenido=f"Esta conversación fue reasignada a {hacia_usuario.nombre or hacia_usuario.email} ({motivo}).",
            tipo=TipoMensajeChat.sistema.value,
        ))

    return {
        "cotizaciones_reasignadas": int(cotizaciones or 0),
        "ordenes_reasignadas": int(ordenes or 0),
        "conversaciones_reasignadas": len(conversaciones),
    }


@router.put("/asesores/{asesor_id}/estado", response_model=AsesorEstadoResponse)
async def actualizar_estado_asesor(
    asesor_id: str,
    datos: AsesorEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """Activa o desactiva un asesor de la empresa (solo la cuenta dueña, y solo de su propia empresa).

    Al desactivarlo, toda su carga de trabajo (cotizaciones, órdenes y chats)
    pasa a la cuenta dueña para que ninguna negociación quede huérfana.
    """
    try:
        asesor_id_str = str(UUID(asesor_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de asesor inválido")

    importador_id_str = current_user.get("importador_id")
    asesor = db.query(Usuario).filter(
        Usuario.id == asesor_id_str,
        Usuario.importador_id == importador_id_str,
        Usuario.rol == "asesor"
    ).first()

    if not asesor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asesor no encontrado")

    estaba_activo = bool(asesor.activo)
    asesor.activo = datos.activo

    traspaso = {"cotizaciones_reasignadas": 0, "ordenes_reasignadas": 0, "conversaciones_reasignadas": 0}
    if estaba_activo and not datos.activo:
        dueno = _cuenta_duena(db, importador_id_str)
        if not dueno:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La empresa no tiene cuenta dueña a la que reasignar el trabajo del asesor",
            )
        traspaso = _traspasar_carga_de_trabajo(
            db,
            desde_usuario_id=asesor_id_str,
            hacia_usuario=dueno,
            motivo="el asesor fue desactivado",
        )

    db.commit()
    db.refresh(asesor)

    return AsesorEstadoResponse(
        **AsesorResponse.model_validate(asesor).model_dump(),
        **traspaso,
    )


@router.put("/cotizaciones/{cotizacion_id}/asignar", response_model=ReasignacionResponse)
async def asignar_asesor_a_cotizacion(
    cotizacion_id: str,
    datos: AsignarAsesorRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    """La cuenta dueña asigna (o reasigna) el responsable de una cotización.

    Hasta ahora el único mecanismo era el reclamo por orden de llegada, sin
    manera de corregirlo: si el asesor equivocado reclamaba una cotización,
    nadie podía moverla. Con `asesor_id = null` la cotización vuelve al pool.
    """
    from models.chat import ConversacionChat

    try:
        cotizacion_id_str = str(UUID(cotizacion_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de cotización inválido")

    importador_id_str = current_user.get("importador_id")
    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id_str).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    # Solo se puede asignar sobre cotizaciones que la empresa está atendiendo.
    propia = cotizacion.importador_id == importador_id_str
    if not propia:
        propia = db.query(Propuesta.id).filter(
            Propuesta.cotizacion_id == cotizacion_id_str,
            Propuesta.importador_id == importador_id_str,
        ).first() is not None
    if not propia:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cotización no pertenece a tu empresa",
        )

    if datos.asesor_id is None:
        cotizacion.asesor_asignado_id = None
        conversacion = db.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion_id_str
        ).first()
        if conversacion:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La cotización ya tiene una conversación abierta: asigna otro responsable en vez de devolverla al pool",
            )
        db.commit()
        return ReasignacionResponse(cotizaciones_reasignadas=1)

    try:
        nuevo_id = str(UUID(datos.asesor_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de asesor inválido")

    destino = db.query(Usuario).filter(
        Usuario.id == nuevo_id,
        Usuario.importador_id == importador_id_str,
        Usuario.rol.in_(("asesor", "importador")),
        Usuario.activo.is_(True),
    ).first()
    if not destino:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El asesor no existe, no pertenece a tu empresa o está desactivado",
        )

    cotizacion.asesor_asignado_id = nuevo_id

    conversaciones = 0
    conversacion = db.query(ConversacionChat).filter(
        ConversacionChat.cotizacion_id == cotizacion_id_str
    ).first()
    if conversacion and conversacion.importador_usuario_id != nuevo_id:
        anterior = conversacion.importador_usuario_id
        traspaso = _traspasar_carga_de_trabajo(
            db,
            desde_usuario_id=anterior,
            hacia_usuario=destino,
            motivo="reasignación del responsable por la empresa",
            solo_cotizacion_id=cotizacion_id_str,
        )
        conversaciones = traspaso["conversaciones_reasignadas"]

    db.commit()
    return ReasignacionResponse(
        cotizaciones_reasignadas=1,
        conversaciones_reasignadas=conversaciones,
    )


@router.delete("/asesores/{asesor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_asesor(
    asesor_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    """
    Eliminación física (hard delete) de un asesor de la empresa.

    Preferible usar `PUT /importadores/asesores/{id}/estado` (soft delete) si el
    asesor tiene historial de cotizaciones/chat. El hard delete solo se permite
    cuando el asesor no tiene cotizaciones asignadas ni es participante de chats.
    """
    try:
        asesor_id_str = str(UUID(asesor_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de asesor inválido")

    importador_id_str = current_user.get("importador_id")
    asesor = db.query(Usuario).filter(
        Usuario.id == asesor_id_str,
        Usuario.importador_id == importador_id_str,
        Usuario.rol == "asesor",
    ).first()
    if not asesor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asesor no encontrado")

    cotizaciones_asignadas = db.query(Cotizacion).filter(
        Cotizacion.asesor_asignado_id == asesor_id_str
    ).count()
    if cotizaciones_asignadas > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "El asesor tiene cotizaciones asignadas. "
                "Desactívalo con PUT .../estado o reasigna las cotizaciones antes de eliminarlo."
            ),
        )

    from models.chat import ConversacionChat, MensajeChat
    from models.propuesta import Propuesta as PropuestaModel
    from sqlalchemy.exc import IntegrityError

    chats = db.query(ConversacionChat).filter(
        ConversacionChat.importador_usuario_id == asesor_id_str
    ).count()
    if chats > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "El asesor participa en conversaciones de chat. "
                "Usa soft-delete (PUT .../estado) para conservar el historial."
            ),
        )

    mensajes = db.query(MensajeChat).filter(MensajeChat.remitente_id == asesor_id_str).count()
    if mensajes > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "El asesor tiene mensajes de chat históricos. "
                "Usa soft-delete (PUT .../estado) para conservar la trazabilidad."
            ),
        )

    propuestas_creadas = db.query(PropuestaModel).filter(
        PropuestaModel.creado_por_usuario_id == asesor_id_str
    ).count()
    if propuestas_creadas > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "El asesor redactó propuestas. "
                "Usa soft-delete (PUT .../estado); el hard delete borraría trazabilidad comercial."
            ),
        )

    try:
        db.delete(asesor)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No se puede eliminar físicamente: hay referencias en otras tablas. "
                "Usa soft-delete con PUT .../estado."
            ),
        )
    return None


@router.get("/metricas", response_model=MetricasImportadorResponse)
async def metricas_importador(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    """
    Resumen comercial de la empresa: cotizaciones respondidas, tasa de aceptación,
    volumen cotizado y rendimiento (panel importadora).

    Consultas agregadas (COUNT/SUM) — evita cargar todas las filas en memoria
    (crítico con 100+ ops concurrentes).
    """
    importador_id = current_user.get("importador_id")
    if not importador_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin empresa asociada")

    propuestas_enviadas = db.query(func.count(Propuesta.id)).filter(
        Propuesta.importador_id == importador_id,
        Propuesta.estado != EstadoPropuesta.borrador.value,
    ).scalar() or 0
    propuestas_aceptadas = db.query(func.count(Propuesta.id)).filter(
        Propuesta.importador_id == importador_id,
        Propuesta.estado == EstadoPropuesta.aceptada.value,
    ).scalar() or 0
    volumen = db.query(func.coalesce(func.sum(Propuesta.precio_ofrecido_usd), 0.0)).filter(
        Propuesta.importador_id == importador_id,
        Propuesta.estado != EstadoPropuesta.borrador.value,
    ).scalar() or 0.0

    cotizaciones_dirigidas = db.query(func.count(Cotizacion.id)).filter(
        Cotizacion.importador_id == importador_id
    ).scalar() or 0
    total_recibidas = cotizaciones_dirigidas
    cuentas_empresa = [
        row[0] for row in db.query(Usuario.id).filter(
            Usuario.importador_id == importador_id,
            Usuario.rol.in_(["asesor", "importador"]),
        ).all()
    ]
    if cuentas_empresa:
        reclamadas = db.query(func.count(Cotizacion.id)).filter(
            Cotizacion.asesor_asignado_id.in_(cuentas_empresa)
        ).scalar() or 0
        total_recibidas = max(total_recibidas, reclamadas)

    tasa = (propuestas_aceptadas / propuestas_enviadas * 100) if propuestas_enviadas else 0.0

    ordenes_totales = db.query(func.count(Orden.id)).filter(
        Orden.importador_id == importador_id
    ).scalar() or 0
    # `EstadoOrden.entregado` es el único estado final del modelo. La lista que
    # había aquí ("entregada", "cancelada", "completada") no existe en el enum,
    # así que ninguna orden casaba y las ya entregadas seguían contando como
    # activas en el panel de la empresa.
    ordenes_activas = db.query(func.count(Orden.id)).filter(
        Orden.importador_id == importador_id,
        Orden.estado != EstadoOrden.entregado.value,
    ).scalar() or 0

    asesores_activos = db.query(func.count(Usuario.id)).filter(
        Usuario.importador_id == importador_id,
        Usuario.rol == "asesor",
        Usuario.activo.is_(True),
    ).scalar() or 0

    # Muestra acotada (300) con JOIN — sin N+1 por propuesta
    muestra = (
        db.query(Propuesta.fecha_envio, Cotizacion.fecha_creacion)
        .join(Cotizacion, Cotizacion.id == Propuesta.cotizacion_id)
        .filter(
            Propuesta.importador_id == importador_id,
            Propuesta.estado != EstadoPropuesta.borrador.value,
            Propuesta.fecha_envio.isnot(None),
            Cotizacion.fecha_creacion.isnot(None),
        )
        .limit(300)
        .all()
    )
    tiempos = []
    for fecha_envio, fecha_creacion in muestra:
        if fecha_envio and fecha_creacion:
            tiempos.append((fecha_envio - fecha_creacion).total_seconds() / 3600)
    tiempo_prom = round(sum(tiempos) / len(tiempos), 2) if tiempos else None

    return MetricasImportadorResponse(
        importador_id=importador_id,
        total_cotizaciones_recibidas=int(total_recibidas),
        total_propuestas_enviadas=int(propuestas_enviadas),
        total_propuestas_aceptadas=int(propuestas_aceptadas),
        tasa_aceptacion_pct=round(float(tasa), 2),
        volumen_cotizado_usd=round(float(volumen), 2),
        ordenes_activas=int(ordenes_activas),
        ordenes_totales=int(ordenes_totales),
        asesores_activos=int(asesores_activos),
        tiempo_promedio_respuesta_horas=tiempo_prom,
    )


# ==================== Formulario de cotización personalizable (Fase 3) ====================

@router.post("/campos-personalizados", response_model=CampoPersonalizadoResponse, status_code=status.HTTP_201_CREATED)
async def crear_campo_personalizado(
    datos: CampoPersonalizadoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Crea un campo personalizado para el formulario de cotización de la empresa.
    Solo disponible para empresas marcadas como solo_cotizaciones_directas=True:
    a cambio de definir su propio formulario, quedan fuera del matching de la red abierta.
    """
    importador_id_str = current_user.get("importador_id")
    importador = db.query(Importador).filter(Importador.id == importador_id_str).first()

    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")

    if not importador.solo_cotizaciones_directas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo las empresas de 'solo cotizaciones directas' pueden personalizar su formulario"
        )

    if datos.tipo not in ("texto", "numero", "select", "booleano"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de campo inválido")

    from uuid import uuid4
    nuevo_campo = CampoPersonalizado(
        id=str(uuid4()),
        importador_id=importador_id_str,
        etiqueta=datos.etiqueta,
        tipo=datos.tipo,
        opciones=datos.opciones,
        obligatorio=datos.obligatorio,
        orden=datos.orden
    )
    db.add(nuevo_campo)
    db.commit()
    db.refresh(nuevo_campo)

    return nuevo_campo

@router.get("/campos-personalizados", response_model=List[CampoPersonalizadoResponse])
async def listar_mis_campos_personalizados(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """Lista los campos personalizados de la empresa del usuario autenticado."""
    importador_id_str = current_user.get("importador_id")
    campos = db.query(CampoPersonalizado).filter(
        CampoPersonalizado.importador_id == importador_id_str
    ).order_by(CampoPersonalizado.orden.asc()).all()

    return campos

@router.put("/campos-personalizados/{campo_id}", response_model=CampoPersonalizadoResponse)
async def actualizar_campo_personalizado(
    campo_id: str,
    datos: CampoPersonalizadoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """Actualiza un campo personalizado. Solo el dueño de la empresa que lo creó."""
    importador_id_str = current_user.get("importador_id")
    campo = db.query(CampoPersonalizado).filter(
        CampoPersonalizado.id == campo_id,
        CampoPersonalizado.importador_id == importador_id_str
    ).first()

    if not campo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campo personalizado no encontrado")

    datos_actualizados = datos.model_dump(exclude_unset=True)
    for k, v in datos_actualizados.items():
        setattr(campo, k, v)

    db.commit()
    db.refresh(campo)

    return campo

@router.delete("/campos-personalizados/{campo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_campo_personalizado(
    campo_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """Elimina un campo personalizado. Solo el dueño de la empresa que lo creó."""
    importador_id_str = current_user.get("importador_id")
    campo = db.query(CampoPersonalizado).filter(
        CampoPersonalizado.id == campo_id,
        CampoPersonalizado.importador_id == importador_id_str
    ).first()

    if not campo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campo personalizado no encontrado")

    db.delete(campo)
    db.commit()

    return None

# ==================== Catálogo enriquecido del dashboard del solicitante (Fase 6) ====================
# NOTA: rutas de un solo segmento literal, deben registrarse ANTES de "/{importador_id}".

@router.get("/destacados", response_model=List[ImportadorResponse])
async def listar_importadores_destacados(
    limite: int = Query(10, ge=1, le=50, description="Cantidad máxima de empresas a devolver"),
    db: Session = Depends(get_db)
):
    """
    Empresas destacadas del dashboard del solicitante.

    El criterio es el peso de las certificaciones que la plataforma les otorgó,
    no una calificación promedio: ese campo nunca se alimentó de reseñas reales.
    """
    puntajes = subconsulta_puntaje_publicidad(db)
    filas = (
        db.query(Importador)
        .outerjoin(puntajes, puntajes.c.importador_id == Importador.id)
        .filter(Importador.estado == "activo")
        .order_by(
            func.coalesce(puntajes.c.puntaje, 0.0).desc(),
            Importador.verificado.desc(),
            Importador.fecha_registro.asc(),
        )
        .limit(limite)
        .all()
    )
    return _con_certificaciones(db, filas)

@router.get("/por-categoria", response_model=dict)
async def listar_importadores_por_categoria(
    db: Session = Depends(get_db)
):
    """
    Empresas importadoras activas agrupadas por categoría/especialidad de
    producto, para la sección "Por categoría" del dashboard del solicitante.
    Una empresa con varias especialidades aparece en cada una de sus categorías.
    """
    importadores = db.query(Importador).filter(Importador.estado == "activo").all()
    respuestas = {r.id: r for r in _con_certificaciones(db, importadores)}

    agrupado: dict[str, list] = {}
    for imp in importadores:
        categorias = imp.especialidad_producto or []
        for categoria in categorias:
            agrupado.setdefault(categoria, []).append(respuestas[str(imp.id)].model_dump(mode="json"))

    return agrupado

@router.get("/certificados", response_model=List[ImportadorResponse])
async def listar_importadores_certificados(
    db: Session = Depends(get_db)
):
    """
    Empresas importadoras activas y verificadas ("socio verificado" por el
    equipo de la plataforma), para la sección "Empresas certificadas" del
    dashboard del solicitante.
    """
    puntajes = subconsulta_puntaje_publicidad(db)
    filas = (
        db.query(Importador)
        .outerjoin(puntajes, puntajes.c.importador_id == Importador.id)
        .filter(
            Importador.estado == "activo",
            Importador.verificado == True,  # noqa: E712 - comparación explícita requerida por SQLAlchemy
        )
        .order_by(func.coalesce(puntajes.c.puntaje, 0.0).desc(), Importador.fecha_registro.asc())
        .all()
    )
    return _con_certificaciones(db, filas)


# ==================== Evidencias de perfil ====================

@router.post("/evidencias", response_model=EvidenciaImportadorResponse, status_code=status.HTTP_201_CREATED)
async def crear_evidencia(
    datos: EvidenciaImportadorCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    from uuid import uuid4
    from models.evidencia import EvidenciaImportador, EstadoEvidenciaImportador

    importador_id = current_user.get("importador_id")
    if not importador_id:
        raise HTTPException(status_code=400, detail="Cuenta sin empresa asociada")

    ev = EvidenciaImportador(
        id=str(uuid4()),
        importador_id=importador_id,
        tipo=datos.tipo,
        titulo=datos.titulo,
        descripcion=datos.descripcion,
        url=datos.url,
        estado=EstadoEvidenciaImportador.pendiente.value,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.get("/evidencias", response_model=List[EvidenciaImportadorResponse])
async def listar_mis_evidencias(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    from models.evidencia import EvidenciaImportador

    importador_id = current_user.get("importador_id")
    return db.query(EvidenciaImportador).filter(
        EvidenciaImportador.importador_id == importador_id
    ).order_by(EvidenciaImportador.fecha_creacion.desc()).all()


@router.delete("/evidencias/{evidencia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_evidencia(
    evidencia_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador")),
):
    from models.evidencia import EvidenciaImportador

    try:
        eid = str(UUID(evidencia_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    ev = db.query(EvidenciaImportador).filter(
        EvidenciaImportador.id == eid,
        EvidenciaImportador.importador_id == current_user.get("importador_id"),
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    db.delete(ev)
    db.commit()
    return None


@router.get("/{importador_id}/evidencias", response_model=List[EvidenciaImportadorResponse])
async def listar_evidencias_aprobadas_publicas(
    importador_id: str,
    db: Session = Depends(get_db),
):
    """Catálogo público: solo evidencias aprobadas por admin."""
    from models.evidencia import EvidenciaImportador, EstadoEvidenciaImportador

    try:
        iid = str(UUID(importador_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Importador no encontrado")
    return db.query(EvidenciaImportador).filter(
        EvidenciaImportador.importador_id == iid,
        EvidenciaImportador.estado == EstadoEvidenciaImportador.aprobada.value,
    ).order_by(EvidenciaImportador.fecha_creacion.desc()).all()


@router.get("/{importador_id}", response_model=ImportadorResponse)
async def obtener_importador(
    importador_id: str,
    db: Session = Depends(get_db)
):
    """
    Obtiene los detalles de un importador específico.
    
    - **importador_id**: ID del importador (UUID)
    """
    try:
        # Validar que el ID sea un UUID válido
        uuid_obj = UUID(importador_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    importador = db.query(Importador).filter(
        Importador.id == str(uuid_obj),  # Convertir a string para SQLite
        Importador.estado == "activo"
    ).first()
    
    if not importador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importador no encontrado"
        )

    return _una_con_certificaciones(db, importador)

# El alta de importadoras vive solo en `POST /admin/importadores`: crea la empresa
# junto con su cuenta dueño (representante legal) en un paso. Aquí no se expone un
# POST propio porque crear la ficha suelta dejaba empresas sin representante.

# ==================== Endpoints de la bandeja de solicitudes del importador (Tarea 2.5) ====================

@router.get("/{importador_id}/solicitudes-dirigidas", response_model=List[dict])
async def listar_solicitudes_dirigidas(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Listar cotizaciones dirigidas al importador con estado "dirigida" o "propuestas_recibidas".
    
    - **importador_id**: ID del importador (UUID)
    """
    try:
        importador_id_str = str(UUID(importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    # Verificar que el usuario pertenece a la empresa indicada (evita IDOR entre empresas)
    if importador_id_str != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede ver sus propias solicitudes"
        )
    
    # Listar cotizaciones dirigidas al importador con estado "dirigida" o "propuestas_recibidas"
    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.importador_id == importador_id_str,
        Cotizacion.estado.in_([EstadoCotizacion.dirigida.value, EstadoCotizacion.propuestas_recibidas.value])
    ).order_by(Cotizacion.fecha_creacion.desc()).all()
    
    return [
        {
            "id": str(c.id),
            "solicitante_id": c.solicitante_id,
            "modalidad": c.modalidad,
            "nombre_producto": c.nombre_producto,
            "descripcion_cliente": c.descripcion_cliente,
            "cantidad_minima": c.cantidad_minima,
            "precio_objetivo_usd": c.precio_objetivo_usd,
            "incoterm": c.incoterm,
            "estado": c.estado.value if isinstance(c.estado, EstadoCotizacion) else c.estado,
            "fecha_creacion": c.fecha_creacion.isoformat() if hasattr(c.fecha_creacion, 'isoformat') else str(c.fecha_creacion),
            # Información de la propuesta si existe
            "propuesta_enviada": any(
                p.importador_id == importador_id_str and p.estado == EstadoPropuesta.pendiente.value
                for p in c.propuestas
            ) if hasattr(c, 'propuestas') else False
        }
        for c in cotizaciones
    ]

@router.get("/{importador_id}/solicitudes-abiertas", response_model=List[dict])
async def listar_solicitudes_abiertas(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Listar cotizaciones abiertas que aplican al importador (usando el motor de matching).
    
    - **importador_id**: ID del importador (UUID)
    """
    try:
        importador_id_str = str(UUID(importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    # Verificar que el usuario pertenece a la empresa indicada (evita IDOR entre empresas)
    if importador_id_str != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede ver sus propias solicitudes"
        )
    
    # Listar cotizaciones abiertas que aplican al importador (estado "abierta" o "propuestas_recibidas")
    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.modalidad == "abierta",
        Cotizacion.estado.in_([EstadoCotizacion.abierta.value, EstadoCotizacion.propuestas_recibidas.value])
    ).order_by(Cotizacion.fecha_creacion.desc()).all()
    
    # Índice Redis por importador (SET) — sin KEYS O(N). Si Redis no está
    # disponible, se degrada a "sin resultados" en vez de un error 500.
    from services.matching_service import listar_cotizaciones_matching_importador
    matching_ids = listar_cotizaciones_matching_importador(importador_id_str)

    resultados = []
    for c in cotizaciones:
        if config.redis_client and str(c.id) not in matching_ids:
            continue
        
        # Verificar si el importador ya envió una propuesta a esta cotización
        propuesta_enviada = any(
            p.importador_id == importador_id_str and p.estado == EstadoPropuesta.pendiente.value
            for p in c.propuestas
        ) if hasattr(c, 'propuestas') else False
        
        resultados.append({
            "id": str(c.id),
            "solicitante_id": c.solicitante_id,
            "modalidad": c.modalidad,
            "nombre_producto": c.nombre_producto,
            "descripcion_cliente": c.descripcion_cliente,
            "cantidad_minima": c.cantidad_minima,
            "precio_objetivo_usd": c.precio_objetivo_usd,
            "incoterm": c.incoterm,
            "estado": c.estado.value if isinstance(c.estado, EstadoCotizacion) else c.estado,
            "fecha_creacion": c.fecha_creacion.isoformat() if hasattr(c.fecha_creacion, 'isoformat') else str(c.fecha_creacion),
            "propuesta_enviada": propuesta_enviada
        })
    
    return resultados

@router.get("/{importador_id}/ordenes-activas", response_model=List[dict])
async def listar_ordenes_activas_importador(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Listar órdenes asignadas al importador con estado diferente a "entregado".
    
    - **importador_id**: ID del importador (UUID)
    """
    try:
        importador_id_str = str(UUID(importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    # Verificar que el usuario pertenece a la empresa indicada (evita IDOR entre empresas)
    if importador_id_str != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede ver sus propias órdenes"
        )
    
    
    # Listar órdenes activas (estado diferente a "entregado")
    estados_activos = [e.value for e in EstadoOrden if e != EstadoOrden.entregado]
    ordenes = db.query(Orden).filter(
        Orden.importador_id == importador_id_str,
        Orden.estado.in_(estados_activos)
    ).order_by(Orden.fecha_creacion.desc()).all()
    
    return [
        {
            "id": str(o.id),
            "cotizacion_id": o.cotizacion_id,
            "solicitante_id": o.solicitante_id,
            "estado": o.estado.value if isinstance(o.estado, EstadoOrden) else o.estado,
            "precio_acordado_usd": o.precio_acordado_usd,
            "tiempo_estimado_entrega": o.tiempo_estimado_entrega,
            "fecha_creacion": o.fecha_creacion.isoformat() if hasattr(o.fecha_creacion, 'isoformat') else str(o.fecha_creacion),
            # Información de la cotización asociada
            "nombre_producto": o.cotizacion.nombre_producto if o.cotizacion else None,
            "cantidad_minima": o.cotizacion.cantidad_minima if o.cotizacion else None
        }
        for o in ordenes
    ]

# ==================== Personalización del perfil de empresa (Fase 2) ====================

@router.put("/{importador_id}", response_model=ImportadorResponse)
async def actualizar_perfil_importador(
    importador_id: str,
    datos: ImportadorUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Autoservicio de personalización del perfil de la empresa. Solo la cuenta dueña
    (rol="importador") de esa empresa puede modificarlo.
    """
    try:
        importador_id_str = str(UUID(importador_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de importador inválido")

    if importador_id_str != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede editar el perfil de su propia empresa"
        )

    importador = db.query(Importador).filter(Importador.id == importador_id_str).first()
    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")

    datos_actualizados = datos.model_dump(exclude_unset=True)

    # El frontend guarda el tier dentro de `perfil_publico`; la columna es la
    # fuente de verdad. El campo de primer nivel manda si llegan los dos.
    tier = datos_actualizados.pop("tier_minimo_requerido", None)
    perfil = datos_actualizados.get("perfil_publico")
    if tier is None and isinstance(perfil, dict) and "tier_minimo_requerido" in perfil:
        tier = perfil["tier_minimo_requerido"]
        if tier not in TIERS_EMPRESA:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tier inválido. Usa Bronze, Silver, Gold o Élite",
            )

    for campo, valor in datos_actualizados.items():
        setattr(importador, campo, valor)

    if tier is not None:
        importador.tier_minimo_requerido = tier
        if isinstance(importador.perfil_publico, dict):
            # Copia nueva: mutar el dict en sitio no marca la columna JSON como sucia.
            importador.perfil_publico = {**importador.perfil_publico, "tier_minimo_requerido": tier}

    db.commit()
    db.refresh(importador)

    return _una_con_certificaciones(db, importador)

@router.get("/{importador_id}/formulario", response_model=FormularioImportadorResponse)
async def obtener_formulario_importador(
    importador_id: str,
    db: Session = Depends(get_db)
):
    """
    Endpoint público que indica al frontend si debe renderizar el formulario
    estándar del PDF o el formulario personalizado de esta empresa antes de
    enviar POST /cotizaciones.
    """
    try:
        importador_id_str = str(UUID(importador_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de importador inválido")

    importador = db.query(Importador).filter(Importador.id == importador_id_str).first()
    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")

    campos = []
    if importador.solo_cotizaciones_directas:
        campos = db.query(CampoPersonalizado).filter(
            CampoPersonalizado.importador_id == importador_id_str
        ).order_by(CampoPersonalizado.orden.asc()).all()

    return FormularioImportadorResponse(
        importador_id=importador_id_str,
        solo_cotizaciones_directas=importador.solo_cotizaciones_directas,
        campos_personalizados=campos
    )
