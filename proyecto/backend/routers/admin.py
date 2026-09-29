import logging
from html import escape
from datetime import datetime
from pathlib import Path
from uuid import UUID as PyUUID, uuid4
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased

from database import Base
from models.usuario import Usuario, ORDEN_TIERS_COTIZANTE
from models.tier import MovimientoPuntoCotizacion, UmbralTierCotizante
from models.importador import Importador
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.orden import Orden
from models.certificacion import Certificacion, CertificacionImportador
from models.solicitud_recreacion import SolicitudRecreacion, EstadoSolicitudRecreacion
from models.credito import MovimientoCredito, TipoMovimientoCredito
from schemas.importador import AdminCrearImportadorRequest, AdminCrearImportadorResponse, ImportadorResponse
from schemas.admin import (
    UsuarioAdminResponse,
    UsuarioEstadoUpdate,
    DisputaOrdenResponse,
    MetricasResponse,
    ConversacionAdminItem,
    ConversacionesAdminResponse,
    MensajeAdminItem,
    MensajeSoporteRequest,
    CrearAgenteSoporteRequest,
    NivelAgenteRequest,
    AgenteSoporteItem,
    ExpedienteVerificacion,
    RetirarVerificacionRequest,
    CotizanteAdminResponse,
    TierUpdateRequest,
    UmbralTierResponse,
    UmbralesTierUpdateRequest,
    PuntosCotizacionUpdateRequest,
    MovimientoPuntoCotizacionResponse,
    EnvioCorreoMasivoRequest,
    EnvioCorreoMasivoResponse,
)
from schemas.orden import ResolverDisputaRequest, OrdenResponse
from schemas.credito import SolicitudRecreacionResponse, ResolverRecreacionRequest
from schemas.certificacion import (
    CertificacionCreate,
    CertificacionUpdate,
    CertificacionResponse,
    CertificacionesDeEmpresaResponse,
    OtorgarCertificacionRequest,
)
from schemas.features import RevisarEvidenciaRequest, ResolverDisputaRoomRequest
from services.certificacion_service import (
    adjuntar_certificaciones,
    certificaciones_por_importador,
    puntaje_de,
)
from utils.dependencies import get_db, require_rol, require_rol_in

# Lo que el equipo de atención al cliente comparte con la administración: la
# supervisión de conversaciones y la resolución de incidentes. Todo lo demás de
# este router sigue siendo exclusivo de `admin`.
require_equipo = require_rol_in("admin", "soporte")
from utils.security import hash_password
from utils.email import construir_html_zarpi, enviar_correo

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/admin", tags=["Administración"])

ROLES_CORREO_ADMIN = {"solicitante", "importador", "asesor", "soporte", "admin"}


def _validar_tier_admin(tier: str) -> str:
    if tier not in ORDEN_TIERS_COTIZANTE:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tier inválido")
    return tier


def _cotizante_response(usuario: Usuario) -> CotizanteAdminResponse:
    return CotizanteAdminResponse(
        id=str(usuario.id),
        email=usuario.email,
        nombre=usuario.nombre or usuario.razon_social,
        tier=usuario.tier,
        tier_manual=bool(usuario.tier_manual),
        puntos_cotizacion=int(usuario.puntos_cotizacion or 0),
        fecha_creacion=usuario.fecha_creacion,
    )


@router.get("/cotizantes", response_model=List[CotizanteAdminResponse])
async def listar_cotizantes_admin(
    buscar: Optional[str] = Query(None, max_length=120),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    query = db.query(Usuario).filter(Usuario.rol == "solicitante")
    if buscar and buscar.strip():
        patron = f"%{buscar.strip()}%"
        query = query.filter(or_(Usuario.nombre.ilike(patron), Usuario.razon_social.ilike(patron), Usuario.email.ilike(patron)))
    return [_cotizante_response(usuario) for usuario in query.order_by(Usuario.fecha_creacion.desc()).limit(500).all()]


@router.put("/cotizantes/{usuario_id}/tier", response_model=CotizanteAdminResponse)
async def actualizar_tier_cotizante(
    usuario_id: str,
    datos: TierUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    tier = _validar_tier_admin(datos.tier)
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.rol == "solicitante").first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotizante no encontrado")
    usuario.tier = tier
    usuario.tier_manual = True
    db.commit()
    db.refresh(usuario)
    return _cotizante_response(usuario)


@router.get("/cotizantes/tier-umbrales", response_model=List[UmbralTierResponse])
async def listar_umbrales_tier(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    filas = db.query(UmbralTierCotizante).order_by(UmbralTierCotizante.tier).all()
    return [UmbralTierResponse.model_validate(fila) for fila in filas]


@router.put("/cotizantes/tier-umbrales", response_model=List[UmbralTierResponse])
async def actualizar_umbrales_tier(
    datos: UmbralesTierUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    tiers_recibidos = {item.tier for item in datos.umbrales}
    if tiers_recibidos != set(ORDEN_TIERS_COTIZANTE):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Debes enviar los cuatro tiers")
    for item in datos.umbrales:
        _validar_tier_admin(item.tier)
        umbral = db.query(UmbralTierCotizante).filter(UmbralTierCotizante.tier == item.tier).first()
        if not umbral:
            umbral = UmbralTierCotizante(tier=item.tier)
            db.add(umbral)
        umbral.minimo_cotizaciones = item.minimo_cotizaciones
        umbral.minimo_ordenes = item.minimo_ordenes
        umbral.minimo_valor_operaciones_usd = item.minimo_valor_operaciones_usd
        umbral.actualizado_por_admin_id = current_user["user_id"]
    db.commit()
    filas = db.query(UmbralTierCotizante).order_by(UmbralTierCotizante.tier).all()
    return [UmbralTierResponse.model_validate(fila) for fila in filas]


@router.post("/cotizantes/{usuario_id}/puntos", response_model=CotizanteAdminResponse)
async def ajustar_puntos_cotizante(
    usuario_id: str,
    datos: PuntosCotizacionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.rol == "solicitante").first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotizante no encontrado")
    resultado = db.query(Usuario).filter(
        Usuario.id == usuario_id,
        Usuario.puntos_cotizacion + datos.delta >= 0,
    ).update({Usuario.puntos_cotizacion: Usuario.puntos_cotizacion + datos.delta}, synchronize_session=False)
    if resultado != 1:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ajuste no puede dejar saldo negativo")
    db.refresh(usuario)
    db.add(MovimientoPuntoCotizacion(
        usuario_id=usuario_id,
        admin_id=current_user["user_id"],
        tipo=datos.tipo,
        delta=datos.delta,
        saldo_resultante=int(usuario.puntos_cotizacion),
        descripcion=datos.descripcion,
    ))
    db.commit()
    db.refresh(usuario)
    return _cotizante_response(usuario)


@router.get("/cotizantes/{usuario_id}/puntos/movimientos", response_model=List[MovimientoPuntoCotizacionResponse])
async def listar_movimientos_puntos_cotizante(
    usuario_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    existe = db.query(Usuario.id).filter(Usuario.id == usuario_id, Usuario.rol == "solicitante").first()
    if not existe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotizante no encontrado")
    return db.query(MovimientoPuntoCotizacion).filter(
        MovimientoPuntoCotizacion.usuario_id == usuario_id,
    ).order_by(MovimientoPuntoCotizacion.fecha.desc()).limit(500).all()


# ==================== Onboarding de empresas importadoras ====================

@router.post("/importadores", response_model=AdminCrearImportadorResponse, status_code=status.HTTP_201_CREATED)
async def crear_importador_con_dueño(
    datos: AdminCrearImportadorRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """
    **Única vía oficial de alta de importadoras.** Crea la empresa y su cuenta
    dueña / representante legal (`rol="importador"`) en un solo paso. El
    auto-registro público de `importador` está cerrado; siempre hay un dueño que
    actúa como jefe de los asesores (operadores) de esa empresa.
    """
    usuario_existente = db.query(Usuario).filter(Usuario.email == datos.email_dueño).first()
    if usuario_existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado")

    nuevo_importador = Importador(
        id=str(uuid4()),
        nombre_empresa=datos.nombre_empresa,
        logo_url=datos.logo_url,
        especialidad_producto=datos.especialidad_producto,
        paises_origen=datos.paises_origen,
        calificacion_promedio=datos.calificacion_promedio,
        tiempo_respuesta_promedio=datos.tiempo_respuesta_promedio,
        capacidad_volumen=datos.capacidad_volumen,
        solo_cotizaciones_directas=datos.solo_cotizaciones_directas,
        shipping_mark_prefijo=datos.shipping_mark_prefijo,
        estado="activo"
    )
    db.add(nuevo_importador)
    db.flush()  # Necesitamos el id del importador antes de crear la cuenta dueña

    nuevo_dueño = Usuario(
        id=str(uuid4()),
        email=datos.email_dueño,
        password_hash=hash_password(datos.password_dueño),
        rol="importador",
        importador_id=nuevo_importador.id,
        nombre=datos.nombre_dueño,
        activo=True,
        email_verificado=True,
        perfil_completo=bool(datos.nombre_dueño)
    )
    db.add(nuevo_dueño)

    # Transacción atómica: si algo falla, ni la empresa ni la cuenta dueña quedan a medias.
    db.commit()
    db.refresh(nuevo_importador)
    db.refresh(nuevo_dueño)

    return AdminCrearImportadorResponse(
        importador=adjuntar_certificaciones(db, [nuevo_importador])[0],
        usuario_dueño_id=str(nuevo_dueño.id),
        email_dueño=nuevo_dueño.email
    )


# ==================== Equipo de atención al cliente ====================

@router.post("/equipo-soporte", response_model=UsuarioAdminResponse, status_code=status.HTTP_201_CREATED)
async def crear_agente_soporte(
    datos: CrearAgenteSoporteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Da de alta una cuenta del equipo de atención al cliente.

    Estas cuentas atienden los tickets y resuelven incidentes de órdenes, pero
    **no administran la plataforma**: no dan de alta empresas ni usuarios, no
    tocan certificaciones ni copias de seguridad. Por eso son un rol propio y no
    administradores con una nota al margen.

    Solo un administrador puede crearlas: si un agente pudiera crear agentes, el
    control de quién tiene acceso interno dejaría de estar en un único sitio.
    """
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado")

    agente = Usuario(
        id=str(uuid4()),
        email=datos.email,
        password_hash=hash_password(datos.password),
        rol="soporte",
        nombre=datos.nombre,
        telefono=datos.telefono,
        nivel_soporte=datos.nivel,
        activo=True,
        email_verificado=True,
        perfil_completo=True,
    )
    db.add(agente)
    db.commit()
    db.refresh(agente)

    return UsuarioAdminResponse(
        id=str(agente.id),
        email=agente.email,
        rol=agente.rol,
        importador_id=agente.importador_id,
        nombre=agente.nombre,
        activo=agente.activo,
        perfil_completo=agente.perfil_completo,
        fecha_creacion=agente.fecha_creacion,
    )


@router.get("/equipo-soporte", response_model=List[AgenteSoporteItem])
async def listar_equipo_soporte(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo),
):
    """La mesa de soporte con su nivel y su desempeño.

    El promedio sale de las calificaciones que dejan los usuarios al cerrarse
    sus tickets, que es la única medida de calidad que no se puede autoasignar.
    """
    from models.chat import ConversacionChat, TipoConversacion

    agentes = (
        db.query(Usuario)
        .filter(Usuario.rol == "soporte")
        .order_by(Usuario.nivel_soporte.desc(), Usuario.nombre)
        .all()
    )

    filas = []
    for agente in agentes:
        base = db.query(ConversacionChat).filter(
            ConversacionChat.tipo == TipoConversacion.soporte.value,
            ConversacionChat.agente_asignado_id == agente.id,
        )
        asignados = base.count()
        cerrados = base.filter(ConversacionChat.cerrada.is_(True)).count()

        notas = [
            fila[0]
            for fila in base.filter(ConversacionChat.calificacion.isnot(None))
            .with_entities(ConversacionChat.calificacion)
            .all()
        ]

        filas.append(AgenteSoporteItem(
            id=str(agente.id),
            email=agente.email,
            nombre=agente.nombre,
            activo=bool(agente.activo),
            nivel=agente.nivel_soporte,
            tickets_asignados=asignados,
            tickets_cerrados=cerrados,
            calificaciones_recibidas=len(notas),
            calificacion_promedio=round(sum(notas) / len(notas), 2) if notas else None,
        ))

    return filas


@router.put("/equipo-soporte/{usuario_id}/nivel", response_model=AgenteSoporteItem)
async def cambiar_nivel_agente(
    usuario_id: str,
    datos: NivelAgenteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Sube o baja a un agente de nivel según vaya cogiendo experiencia."""
    agente = db.query(Usuario).filter(
        Usuario.id == usuario_id, Usuario.rol == "soporte"
    ).first()
    if not agente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agente no encontrado")

    agente.nivel_soporte = datos.nivel
    db.commit()
    db.refresh(agente)

    return AgenteSoporteItem(
        id=str(agente.id),
        email=agente.email,
        nombre=agente.nombre,
        activo=bool(agente.activo),
        nivel=agente.nivel_soporte,
    )


@router.get("/importadores/{importador_id}/expediente", response_model=ExpedienteVerificacion)
async def expediente_verificacion(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Qué cumple y qué le falta a una empresa para llevar el sello.

    El botón de verificar existía, pero quien lo pulsaba no tenía delante nada
    sobre lo que decidir. Esto reúne lo comprobable desde la propia plataforma
    —cuenta dueña, especialidad, prefijo de embarque, incidentes abiertos,
    material aprobado, actividad real— para que la decisión sea informada.

    No sustituye a la comprobación externa (registro mercantil, referencias):
    esas siguen siendo del criterio de quien administra.
    """
    from services.verificacion_empresa import expediente_de

    expediente = expediente_de(db, importador_id)
    if expediente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")
    return ExpedienteVerificacion(**expediente)


@router.post("/importadores/{importador_id}/verificar", response_model=ImportadorResponse)
async def verificar_importador(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """Marca una empresa importadora como verificada (badge de "socio verificado",
    visible en el catálogo del dashboard del solicitante) y la activa.

    Se rechaza si le faltan requisitos obligatorios: el sello lo ve el cliente al
    elegir con quién contratar, y ponerlo sobre una ficha a medias es
    precisamente lo que lo vacía de significado. Consulta antes
    `GET /admin/importadores/{id}/expediente` para ver qué falta.
    """
    from services.verificacion_empresa import construir_expediente

    try:
        importador_id_str = str(PyUUID(importador_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de importador inválido")

    importador = db.query(Importador).filter(Importador.id == importador_id_str).first()
    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")

    expediente = construir_expediente(db, importador)
    if not expediente["listo_para_verificar"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Faltan requisitos obligatorios para verificar esta empresa: "
                + "; ".join(expediente["pendientes"])
            ),
        )

    importador.estado = "activo"
    importador.verificado = True
    db.commit()
    db.refresh(importador)

    return adjuntar_certificaciones(db, [importador])[0]


@router.post("/importadores/{importador_id}/retirar-verificacion", response_model=ImportadorResponse)
async def retirar_verificacion_importador(
    importador_id: str,
    datos: RetirarVerificacionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Retira el sello de socio verificado.

    Verificar era irreversible desde el panel, lo que dejaba sin salida el caso
    de una empresa que deja de cumplir. Retirar el sello **no la desactiva**:
    sigue operando, simplemente deja de estar avalada por la plataforma.
    """
    try:
        importador_id_str = str(PyUUID(importador_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de importador inválido")

    importador = db.query(Importador).filter(Importador.id == importador_id_str).first()
    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")

    if not importador.verificado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta empresa no está verificada",
        )

    importador.verificado = False
    logger.info(
        "Verificación retirada a %s por %s. Motivo: %s",
        importador.nombre_empresa,
        current_user["user_id"],
        datos.motivo.strip(),
    )

    # Al dueño se le dice, y se le dice por qué: enterarse por el catálogo sería
    # peor que no enterarse.
    from services.notificacion_service import notificar

    dueño = db.query(Usuario).filter(
        Usuario.importador_id == importador.id, Usuario.rol == "importador"
    ).first()
    if dueño:
        notificar(
            db,
            usuario_id=str(dueño.id),
            tipo="empresa",
            titulo="Se retiró el sello de socio verificado",
            mensaje=datos.motivo.strip()[:160],
            data={"importador_id": str(importador.id)},
            enlace_relativo="/empresa/perfil",
        )

    db.commit()
    db.refresh(importador)

    return adjuntar_certificaciones(db, [importador])[0]


@router.put("/importadores/{importador_id}/estado", response_model=ImportadorResponse)
async def actualizar_estado_importador(
    importador_id: str,
    estado: str = Query(..., description="'activo' o 'inactivo'"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """Activa o desactiva una empresa importadora (ej. tras detectar un problema)."""
    if estado not in ("activo", "inactivo"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Estado inválido")

    try:
        importador_id_str = str(PyUUID(importador_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de importador inválido")

    importador = db.query(Importador).filter(Importador.id == importador_id_str).first()
    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importador no encontrado")

    importador.estado = estado
    db.commit()
    db.refresh(importador)

    return adjuntar_certificaciones(db, [importador])[0]


# ==================== Monitoreo de usuarios ====================

@router.get("/usuarios", response_model=List[UsuarioAdminResponse])
async def listar_usuarios(
    rol: Optional[str] = Query(None, description="Filtrar por rol"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """Monitoreo de cuentas de la plataforma, filtrable por rol y estado."""
    query = db.query(Usuario)
    if rol:
        query = query.filter(Usuario.rol == rol)
    if activo is not None:
        query = query.filter(Usuario.activo == activo)

    return query.order_by(Usuario.fecha_creacion.desc()).limit(200).all()


@router.put("/usuarios/{usuario_id}/estado", response_model=UsuarioAdminResponse)
async def actualizar_estado_usuario(
    usuario_id: str,
    datos: UsuarioEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """Activa o desactiva cualquier cuenta de la plataforma (control crítico de seguridad)."""
    try:
        usuario_id_str = str(PyUUID(usuario_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de usuario inválido")

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id_str).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    usuario.activo = datos.activo
    db.commit()
    db.refresh(usuario)

    return usuario


@router.post("/correos/masivo", response_model=EnvioCorreoMasivoResponse)
async def enviar_correo_masivo_admin(
    datos: EnvioCorreoMasivoRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Envía un correo a segmentos o destinatarios concretos de la plataforma.

    Los destinatarios de usuarios siempre salen de la base de datos para evitar
    que una cuenta desactivada o un correo inventado entre por un filtro de rol.
    Los correos escritos manualmente se permiten para contactos específicos.
    """
    roles = {str(rol).strip().lower() for rol in datos.roles if str(rol).strip()}
    roles_invalidos = roles - ROLES_CORREO_ADMIN
    if roles_invalidos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Segmento(s) no válido(s): {', '.join(sorted(roles_invalidos))}",
        )

    usuarios_ids = {str(usuario_id).strip() for usuario_id in datos.usuarios_ids if str(usuario_id).strip()}
    correos = {str(correo).strip().lower() for correo in datos.correos if str(correo).strip()}
    if not roles and not usuarios_ids and not correos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Selecciona al menos un segmento, usuario o correo específico.",
        )

    destinatarios = set(correos)
    if roles or usuarios_ids:
        query = db.query(Usuario.email).filter(Usuario.activo.is_(True))
        filtros = []
        if roles:
            filtros.append(Usuario.rol.in_(roles))
        if usuarios_ids:
            filtros.append(Usuario.id.in_(usuarios_ids))
        query = query.filter(or_(*filtros))
        destinatarios.update(
            str(fila[0]).strip().lower()
            for fila in query.all()
            if fila[0]
        )

    if not destinatarios:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontraron destinatarios activos para la selección.",
        )
    if len(destinatarios) > 500:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Una campaña no puede superar 500 destinatarios.",
        )

    asunto = datos.asunto.strip()
    cuerpo = datos.cuerpo.strip()
    cuerpo_html = construir_html_zarpi(
        asunto,
        f'<div style="white-space:pre-wrap;font-family:Arial,sans-serif">{escape(cuerpo)}</div>',
    )
    fallos = []
    enviados = 0
    for destinatario in sorted(destinatarios):
        if enviar_correo(destinatario, asunto, cuerpo, cuerpo_html):
            enviados += 1
        else:
            fallos.append(destinatario)

    logger.info(
        "Campaña de correo enviada por admin %s: %s destinatarios, %s enviados, %s fallidos",
        current_user["user_id"], len(destinatarios), enviados, len(fallos),
    )
    return EnvioCorreoMasivoResponse(
        destinatarios=len(destinatarios),
        enviados=enviados,
        fallidos=len(fallos),
        fallos=fallos[:50],
    )


# ==================== Cotizaciones abiertas y disputas ====================

@router.get("/cotizaciones-abiertas", response_model=List[dict])
async def listar_cotizaciones_abiertas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """Vista de administración de todas las cotizaciones en modalidad abierta."""
    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.modalidad == "abierta"
    ).order_by(Cotizacion.fecha_creacion.desc()).limit(200).all()

    return [
        {
            "id": str(c.id),
            "solicitante_id": c.solicitante_id,
            "nombre_producto": c.nombre_producto,
            "pais_importacion": c.pais_importacion,
            "linea_producto": c.linea_producto,
            "estado": c.estado.value if isinstance(c.estado, EstadoCotizacion) else c.estado,
            "fecha_creacion": c.fecha_creacion.isoformat() if hasattr(c.fecha_creacion, "isoformat") else str(c.fecha_creacion)
        }
        for c in cotizaciones
    ]


@router.get("/disputas", response_model=List[DisputaOrdenResponse])
async def listar_disputas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo)
):
    """Lista las órdenes con una disputa abierta reportada por el solicitante."""
    ordenes = db.query(Orden).filter(Orden.en_disputa == True).order_by(Orden.fecha_actualizacion.desc()).all()

    return [
        DisputaOrdenResponse(
            id=str(o.id),
            cotizacion_id=o.cotizacion_id,
            importador_id=o.importador_id,
            solicitante_id=o.solicitante_id,
            estado=o.estado.value if hasattr(o.estado, "value") else o.estado,
            motivo_disputa=o.motivo_disputa,
            fecha_actualizacion=o.fecha_actualizacion
        )
        for o in ordenes
    ]


@router.put("/disputas/{orden_id}/resolver", response_model=OrdenResponse)
async def resolver_disputa(
    orden_id: str,
    datos: ResolverDisputaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo)
):
    """Resuelve disputa por orden_id (compat). También actualiza el modelo Disputa si existe."""
    from models.disputa import Disputa, EstadoDisputa, MensajeDisputa, TipoMensajeDisputa
    from datetime import datetime

    try:
        orden_id_str = str(PyUUID(orden_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de orden inválido")

    orden = db.query(Orden).filter(Orden.id == orden_id_str).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    orden.en_disputa = False
    orden.motivo_disputa = f"[RESUELTO] {orden.motivo_disputa or ''} — Resolución: {datos.resolucion}"

    disputa = db.query(Disputa).filter(Disputa.orden_id == orden_id_str).first()
    if disputa:
        disputa.estado = EstadoDisputa.resuelta.value
        disputa.resolucion_admin = datos.resolucion
        disputa.resuelta_por_admin_id = current_user["user_id"]
        disputa.fecha_resolucion = datetime.utcnow()
        db.add(MensajeDisputa(
            id=str(uuid4()),
            disputa_id=disputa.id,
            autor_id=current_user["user_id"],
            contenido=f"Resolución admin: {datos.resolucion}",
            tipo=TipoMensajeDisputa.admin.value,
        ))

    db.commit()
    db.refresh(orden)

    return OrdenResponse(
        id=str(orden.id),
        cotizacion_id=orden.cotizacion_id,
        importador_id=orden.importador_id,
        solicitante_id=orden.solicitante_id,
        asesor_asignado_id=orden.asesor_asignado_id,
        estado=orden.estado.value if hasattr(orden.estado, "value") else orden.estado,
        precio_acordado_usd=orden.precio_acordado_usd,
        tiempo_estimado_entrega=orden.tiempo_estimado_entrega,
        condiciones_adicionales=orden.condiciones_adicionales,
        shipping_mark=orden.shipping_mark,
        en_disputa=orden.en_disputa,
        motivo_disputa=orden.motivo_disputa,
        historial_estados=[],
        documentos_adjuntos=[]
    )


@router.put("/disputas-room/{disputa_id}/resolver", response_model=dict)
async def resolver_disputa_por_id(
    disputa_id: str,
    datos: ResolverDisputaRoomRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo),
):
    from models.disputa import Disputa, EstadoDisputa, MensajeDisputa, TipoMensajeDisputa

    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa no encontrada")
    orden = db.query(Orden).filter(Orden.id == disputa.orden_id).first()
    if orden:
        orden.en_disputa = False
        orden.motivo_disputa = f"[RESUELTO] {orden.motivo_disputa or ''} — {datos.resolucion}"

    disputa.estado = datos.estado
    disputa.resolucion_admin = datos.resolucion
    disputa.resuelta_por_admin_id = current_user["user_id"]
    disputa.fecha_resolucion = datetime.utcnow()
    db.add(MensajeDisputa(
        id=str(uuid4()),
        disputa_id=disputa.id,
        autor_id=current_user["user_id"],
        contenido=f"Resolución admin: {datos.resolucion}",
        tipo=TipoMensajeDisputa.admin.value,
    ))
    db.commit()
    return {"success": True, "disputa_id": disputa.id, "estado": disputa.estado}


@router.put("/evidencias/{evidencia_id}/revisar", response_model=dict)
async def revisar_evidencia_importador(
    evidencia_id: str,
    datos: RevisarEvidenciaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    from models.evidencia import EvidenciaImportador, EstadoEvidenciaImportador

    ev = db.query(EvidenciaImportador).filter(EvidenciaImportador.id == evidencia_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    if datos.estado not in (EstadoEvidenciaImportador.aprobada.value, EstadoEvidenciaImportador.rechazada.value):
        raise HTTPException(status_code=400, detail="Estado inválido")
    ev.estado = datos.estado
    ev.nota_revision = datos.nota_revision
    ev.revisado_por_admin_id = current_user["user_id"]
    ev.fecha_revision = datetime.utcnow()
    db.commit()
    return {"success": True, "id": ev.id, "estado": ev.estado}


# ==================== Recreación de cotizaciones por error (créditos) ====================

@router.get("/recreaciones", response_model=List[SolicitudRecreacionResponse])
async def listar_recreaciones(
    estado: Optional[str] = Query(None, description="Filtrar por estado: 'pendiente', 'aprobada', 'rechazada'"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """Lista las solicitudes de recreación de cotización pendientes de mediación por el admin."""
    query = db.query(SolicitudRecreacion)
    if estado:
        query = query.filter(SolicitudRecreacion.estado == estado)
    return query.order_by(SolicitudRecreacion.fecha_creacion.desc()).all()


@router.put("/recreaciones/{solicitud_id}/resolver", response_model=SolicitudRecreacionResponse)
async def resolver_recreacion(
    solicitud_id: str,
    datos: ResolverRecreacionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """
    El admin decide qué parte fue realmente responsable del error en la
    negociación. Si aprueba y atribuye la responsabilidad a la empresa
    importadora, se reembolsa al solicitante el costo en créditos equivalente a
    una nueva cotización (queda exento de pagar por la recreación). La
    cotización original queda marcada como `cancelada` para trazabilidad; el
    solicitante debe crear una nueva cotización (posiblemente gratuita, gracias
    al reembolso) para continuar el proceso.
    """
    try:
        solicitud_id_str = str(PyUUID(solicitud_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de solicitud inválido")

    solicitud = db.query(SolicitudRecreacion).filter(SolicitudRecreacion.id == solicitud_id_str).first()
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de recreación no encontrada")

    if solicitud.estado != EstadoSolicitudRecreacion.pendiente.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta solicitud ya fue resuelta")

    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == solicitud.cotizacion_origen_id).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización original no encontrada")

    if not datos.aprobado:
        solicitud.estado = EstadoSolicitudRecreacion.rechazada.value
        solicitud.parte_atribuida_final = datos.parte_atribuida_final
        solicitud.resuelto_por_admin_id = current_user["user_id"]
        solicitud.fecha_resolucion = datetime.utcnow()
        db.commit()
        db.refresh(solicitud)
        return solicitud

    solicitud.estado = EstadoSolicitudRecreacion.aprobada.value
    solicitud.parte_atribuida_final = datos.parte_atribuida_final
    solicitud.resuelto_por_admin_id = current_user["user_id"]
    solicitud.fecha_resolucion = datetime.utcnow()

    cotizacion.estado = EstadoCotizacion.cancelada.value
    cotizacion.cancelada_por_error = datos.parte_atribuida_final
    cotizacion.motivo_cancelacion = solicitud.motivo

    # Si la responsable fue la empresa importadora, se exime al solicitante:
    # se le reembolsa el costo equivalente a la cotización cancelada.
    if datos.parte_atribuida_final == "importador" and cotizacion.costo_creditos:
        solicitante = db.query(Usuario).filter(Usuario.id == cotizacion.solicitante_id).first()
        if solicitante:
            from services.credito_wallet import obtener_wallet, acreditar
            wallet = obtener_wallet(db, solicitante)
            acreditar(
                db,
                wallet,
                cotizacion.costo_creditos,
                tipo=TipoMovimientoCredito.reembolso.value,
                cotizacion_id=cotizacion.id,
                descripcion=(
                    f"Reembolso por recreación de cotización {cotizacion.id} "
                    f"(error atribuido a la empresa importadora)"
                ),
            )

    db.commit()
    db.refresh(solicitud)

    return solicitud


# ==================== Métricas de éxito (sección del PDF) ====================

# ==================== Copia de seguridad ====================

@router.get("/backup")
async def descargar_backup(
    db: Session = Depends(get_db),
    incluir_archivos: bool = Query(True, description="Incluir uploads/ y generated_docs/ en el ZIP"),
    current_user: dict = Depends(require_rol("admin")),
):
    """Descarga un ZIP con toda la plataforma: base de datos + archivos subidos.

    Pensado para tomar una foto antes de actualizar y poder volver atrás sin
    depender de integración continua. Se restaura con
    `python scripts/restaurar_backup.py <archivo.zip>`.

    Ojo: el ZIP contiene datos personales y hashes de contraseña de toda la
    plataforma. Trátalo como un secreto.
    """
    import tempfile

    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask

    from services.backup_service import construir_backup, nombre_de_archivo

    # Se escribe a disco en vez de armarlo en memoria: con los uploads dentro,
    # el ZIP puede pesar cientos de MB.
    temporal = Path(tempfile.gettempdir()) / f"q8-backup-{uuid4().hex}.zip"

    try:
        manifiesto = construir_backup(db, temporal, incluir_archivos=incluir_archivos)
    except Exception:
        temporal.unlink(missing_ok=True)
        logger.exception("Fallo generando la copia de seguridad")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo generar la copia de seguridad",
        )

    logger.info(
        "Backup generado por admin %s: %s tablas, %s archivos",
        current_user["user_id"],
        len(manifiesto.get("tablas", {})),
        manifiesto.get("archivos_copiados", 0),
    )

    return FileResponse(
        path=str(temporal),
        media_type="application/zip",
        filename=nombre_de_archivo(),
        # El temporal se borra en cuanto termina de enviarse.
        background=BackgroundTask(lambda: temporal.unlink(missing_ok=True)),
    )


@router.get("/backup/resumen")
async def resumen_backup(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Qué contendría el backup, sin generarlo: filas por tabla y peso de los archivos."""
    from services.backup_service import BACKEND_DIR, DIRECTORIOS_DE_ARCHIVOS, _revision_alembic, _tablas_existentes

    presentes = set(_tablas_existentes())
    tablas = {}
    total_filas = 0
    for tabla in Base.metadata.sorted_tables:
        if tabla.name not in presentes:
            continue
        try:
            total = db.query(func.count()).select_from(tabla).scalar() or 0
        except Exception:
            total = 0
        tablas[tabla.name] = int(total)
        total_filas += int(total)

    archivos = 0
    bytes_archivos = 0
    for nombre_dir in DIRECTORIOS_DE_ARCHIVOS:
        carpeta = BACKEND_DIR / nombre_dir
        if not carpeta.is_dir():
            continue
        for archivo in carpeta.rglob("*"):
            if archivo.is_file():
                archivos += 1
                bytes_archivos += archivo.stat().st_size

    return {
        "revision_alembic": _revision_alembic(db),
        "tablas": tablas,
        "total_filas": total_filas,
        "archivos": archivos,
        "bytes_archivos": bytes_archivos,
    }


# ==================== Certificaciones de plataforma ====================
#
# Sellos que respalda la propia plataforma. Cada uno lleva un `peso_publicidad`
# que suma al puntaje con el que se ordena el catálogo del solicitante, así que
# solo un admin puede crearlos y otorgarlos.

@router.post("/certificaciones", response_model=CertificacionResponse, status_code=status.HTTP_201_CREATED)
async def crear_certificacion(
    datos: CertificacionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Crea un sello desde cero: nombre, descripción, logo y peso publicitario."""
    nombre = datos.nombre.strip()
    if db.query(Certificacion.id).filter(func.lower(Certificacion.nombre) == nombre.lower()).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una certificación llamada '{nombre}'",
        )

    certificacion = Certificacion(
        id=str(uuid4()),
        nombre=nombre,
        descripcion=(datos.descripcion or "").strip(),
        logo_url=datos.logo_url,
        peso_publicidad=float(datos.peso_publicidad or 0.0),
        activa=datos.activa,
        creada_por_admin_id=current_user["user_id"],
    )
    db.add(certificacion)
    db.commit()
    db.refresh(certificacion)

    return _certificacion_response(db, certificacion)


@router.get("/certificaciones", response_model=List[CertificacionResponse])
async def listar_certificaciones_admin(
    db: Session = Depends(get_db),
    incluir_inactivas: bool = Query(True, description="Incluir sellos retirados del catálogo"),
    current_user: dict = Depends(require_rol("admin")),
):
    """Catálogo completo de sellos, con cuántas empresas tiene cada uno."""
    query = db.query(Certificacion)
    if not incluir_inactivas:
        query = query.filter(Certificacion.activa.is_(True))

    filas = query.order_by(Certificacion.peso_publicidad.desc(), Certificacion.nombre.asc()).all()
    conteos = _conteo_por_certificacion(db)

    return [_certificacion_response(db, fila, conteos) for fila in filas]


@router.put("/certificaciones/{certificacion_id}", response_model=CertificacionResponse)
async def actualizar_certificacion(
    certificacion_id: str,
    datos: CertificacionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Edita el sello. Cambiar `peso_publicidad` reordena el catálogo al instante."""
    certificacion = db.query(Certificacion).filter(Certificacion.id == certificacion_id).first()
    if not certificacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificación no encontrada")

    cambios = datos.model_dump(exclude_unset=True)

    nuevo_nombre = cambios.get("nombre")
    if nuevo_nombre:
        nuevo_nombre = nuevo_nombre.strip()
        duplicada = db.query(Certificacion.id).filter(
            func.lower(Certificacion.nombre) == nuevo_nombre.lower(),
            Certificacion.id != certificacion_id,
        ).first()
        if duplicada:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una certificación llamada '{nuevo_nombre}'",
            )
        cambios["nombre"] = nuevo_nombre

    for campo, valor in cambios.items():
        setattr(certificacion, campo, valor)

    db.commit()
    db.refresh(certificacion)

    return _certificacion_response(db, certificacion)


@router.delete("/certificaciones/{certificacion_id}", response_model=CertificacionResponse)
async def retirar_certificacion(
    certificacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Retira el sello del catálogo sin borrarlo.

    No se elimina de verdad: eso perdería el registro de a qué empresas se les
    había otorgado y por qué aparecían destacadas en su momento.
    """
    certificacion = db.query(Certificacion).filter(Certificacion.id == certificacion_id).first()
    if not certificacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificación no encontrada")

    certificacion.activa = False
    db.commit()
    db.refresh(certificacion)

    return _certificacion_response(db, certificacion)


@router.post(
    "/importadores/{importador_id}/certificaciones",
    response_model=CertificacionesDeEmpresaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def otorgar_certificacion(
    importador_id: str,
    datos: OtorgarCertificacionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Respalda a una empresa con un sello de la plataforma."""
    importador = db.query(Importador).filter(Importador.id == importador_id).first()
    if not importador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa importadora no encontrada")

    certificacion = db.query(Certificacion).filter(
        Certificacion.id == datos.certificacion_id,
        Certificacion.activa.is_(True),
    ).first()
    if not certificacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificación no encontrada o retirada del catálogo",
        )

    existente = db.query(CertificacionImportador).filter(
        CertificacionImportador.certificacion_id == certificacion.id,
        CertificacionImportador.importador_id == importador.id,
    ).first()

    if existente and existente.revocada_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La empresa ya tiene esta certificación vigente",
        )

    if existente:
        # Reactivar el otorgamiento anterior conserva la fila histórica.
        existente.revocada_at = None
        existente.fecha_otorgada = datetime.utcnow()
        existente.otorgada_por_admin_id = current_user["user_id"]
        existente.notas = datos.notas
    else:
        db.add(CertificacionImportador(
            id=str(uuid4()),
            certificacion_id=certificacion.id,
            importador_id=importador.id,
            otorgada_por_admin_id=current_user["user_id"],
            notas=datos.notas,
            fecha_otorgada=datetime.utcnow(),
        ))

    db.commit()
    return _certificaciones_de_empresa(db, importador_id)


@router.delete(
    "/importadores/{importador_id}/certificaciones/{certificacion_id}",
    response_model=CertificacionesDeEmpresaResponse,
)
async def revocar_certificacion(
    importador_id: str,
    certificacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    """Retira el respaldo a una empresa. La empresa baja en el catálogo al instante."""
    otorgada = db.query(CertificacionImportador).filter(
        CertificacionImportador.importador_id == importador_id,
        CertificacionImportador.certificacion_id == certificacion_id,
        CertificacionImportador.revocada_at.is_(None),
    ).first()
    if not otorgada:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La empresa no tiene esa certificación vigente",
        )

    otorgada.revocada_at = datetime.utcnow()
    db.commit()

    return _certificaciones_de_empresa(db, importador_id)


@router.get("/importadores/{importador_id}/certificaciones", response_model=CertificacionesDeEmpresaResponse)
async def listar_certificaciones_de_empresa(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin")),
):
    return _certificaciones_de_empresa(db, importador_id)


def _conteo_por_certificacion(db: Session) -> dict:
    """Cuántas empresas tienen vigente cada sello (una sola query)."""
    filas = (
        db.query(CertificacionImportador.certificacion_id, func.count(CertificacionImportador.id))
        .filter(CertificacionImportador.revocada_at.is_(None))
        .group_by(CertificacionImportador.certificacion_id)
        .all()
    )
    return {str(cert_id): int(total) for cert_id, total in filas}


def _certificacion_response(db: Session, certificacion: Certificacion, conteos: Optional[dict] = None) -> CertificacionResponse:
    if conteos is None:
        conteos = _conteo_por_certificacion(db)
    respuesta = CertificacionResponse.model_validate(certificacion)
    respuesta.empresas_certificadas = conteos.get(str(certificacion.id), 0)
    return respuesta


def _certificaciones_de_empresa(db: Session, importador_id: str) -> CertificacionesDeEmpresaResponse:
    certificaciones = certificaciones_por_importador(db, [importador_id]).get(str(importador_id), [])
    return CertificacionesDeEmpresaResponse(
        importador_id=str(importador_id),
        puntaje_publicidad=puntaje_de(certificaciones),
        certificaciones=certificaciones,
    )


# ==================== Supervisión de chats ====================

@router.get("/conversaciones", response_model=ConversacionesAdminResponse)
async def listar_conversaciones_admin(
    db: Session = Depends(get_db),
    buscar: Optional[str] = Query(None, max_length=120, description="Filtra por nombre o email de solicitante/empresa"),
    importador_id: Optional[str] = Query(None, description="Solo conversaciones de esta empresa"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_equipo),
):
    """Todas las conversaciones de la plataforma, para supervisión del equipo.

    Reemplaza el uso de `GET /chat/conversaciones`, que para un admin devolvía
    las 50 más recientes sin filtros ni paginación ni datos de los participantes.
    """
    from models.chat import ConversacionChat, MensajeChat

    solicitante = aliased(Usuario)
    contraparte = aliased(Usuario)

    query = (
        db.query(ConversacionChat, solicitante, contraparte, Importador)
        .outerjoin(solicitante, solicitante.id == ConversacionChat.solicitante_id)
        .outerjoin(contraparte, contraparte.id == ConversacionChat.importador_usuario_id)
        .outerjoin(Importador, Importador.id == contraparte.importador_id)
    )

    if importador_id:
        query = query.filter(contraparte.importador_id == importador_id)

    if buscar:
        patron = f"%{buscar.strip()}%"
        query = query.filter(
            or_(
                solicitante.nombre.ilike(patron),
                solicitante.email.ilike(patron),
                contraparte.nombre.ilike(patron),
                contraparte.email.ilike(patron),
                Importador.nombre_empresa.ilike(patron),
            )
        )

    total = query.count()
    filas = (
        query.order_by(ConversacionChat.fecha_creacion.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for conversacion, usuario_solicitante, usuario_empresa, empresa in filas:
        total_mensajes = db.query(func.count(MensajeChat.id)).filter(
            MensajeChat.conversacion_id == conversacion.id
        ).scalar() or 0
        ultimo = (
            db.query(MensajeChat)
            .filter(MensajeChat.conversacion_id == conversacion.id)
            .order_by(MensajeChat.fecha_envio.desc())
            .first()
        )
        items.append(ConversacionAdminItem(
            id=str(conversacion.id),
            tipo=str(conversacion.tipo or "negociacion"),
            cotizacion_id=str(conversacion.cotizacion_id) if conversacion.cotizacion_id else None,
            orden_id=str(conversacion.orden_id) if conversacion.orden_id else None,
            fecha_creacion=conversacion.fecha_creacion,
            solicitante_id=str(conversacion.solicitante_id) if conversacion.solicitante_id else None,
            solicitante_nombre=usuario_solicitante.nombre if usuario_solicitante else None,
            solicitante_email=usuario_solicitante.email if usuario_solicitante else None,
            importador_usuario_id=str(conversacion.importador_usuario_id),
            importador_usuario_nombre=usuario_empresa.nombre if usuario_empresa else None,
            importador_usuario_email=usuario_empresa.email if usuario_empresa else None,
            importador_id=str(empresa.id) if empresa else None,
            empresa_nombre=empresa.nombre_empresa if empresa else None,
            total_mensajes=int(total_mensajes),
            ultimo_mensaje_texto=(ultimo.contenido[:280] if ultimo else None),
            ultimo_mensaje_fecha=(ultimo.fecha_envio if ultimo else None),
        ))

    return ConversacionesAdminResponse(items=items, total=int(total), limit=limit, offset=offset)


@router.get("/conversaciones/{conversacion_id}/mensajes", response_model=List[MensajeAdminItem])
async def leer_conversacion_admin(
    conversacion_id: str,
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=500),
    current_user: dict = Depends(require_equipo),
):
    """Historial completo de una conversación, para atender el caso desde soporte."""
    from models.chat import ConversacionChat, MensajeChat

    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada")

    filas = (
        db.query(MensajeChat, Usuario)
        .outerjoin(Usuario, Usuario.id == MensajeChat.remitente_id)
        .filter(MensajeChat.conversacion_id == conversacion_id)
        .order_by(MensajeChat.fecha_envio.asc())
        .limit(limit)
        .all()
    )

    return [
        MensajeAdminItem(
            id=str(mensaje.id),
            conversacion_id=str(mensaje.conversacion_id),
            remitente_id=str(mensaje.remitente_id),
            remitente_nombre=remitente.nombre if remitente else None,
            remitente_email=remitente.email if remitente else None,
            remitente_rol=remitente.rol if remitente else None,
            contenido=mensaje.contenido,
            tipo=str(mensaje.tipo),
            fecha_envio=mensaje.fecha_envio,
        )
        for mensaje, remitente in filas
    ]


@router.post(
    "/conversaciones/{conversacion_id}/mensajes",
    response_model=MensajeAdminItem,
    status_code=status.HTTP_201_CREATED,
)
async def responder_conversacion_admin(
    conversacion_id: str,
    datos: MensajeSoporteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_equipo),
):
    """Interviene en una conversación desde soporte.

    Es lo que se necesita para resolver una duda de un solicitante o mediar en un
    incidente con una empresa sin sacar a las partes del hilo donde ya está todo
    el contexto. El mensaje se marca como `sistema` para que se distinga de la
    negociación entre las partes, y **avisa a los dos** participantes: si solo se
    notificara a uno, la mitad implicada se enteraría por casualidad.
    """
    from models.chat import ConversacionChat, MensajeChat, TipoMensajeChat
    from services.notificacion_service import notificar

    conversacion = db.query(ConversacionChat).filter(ConversacionChat.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada")

    texto = datos.contenido.strip()
    mensaje = MensajeChat(
        id=str(uuid4()),
        conversacion_id=conversacion.id,
        remitente_id=current_user["user_id"],
        contenido=f"[Soporte Zarpi] {texto}",
        tipo=TipoMensajeChat.sistema.value,
    )
    db.add(mensaje)

    destinatarios = {
        str(conversacion.solicitante_id or ""),
        str(conversacion.importador_usuario_id or ""),
    } - {"", str(current_user["user_id"])}

    for destinatario_id in destinatarios:
        notificar(
            db,
            usuario_id=destinatario_id,
            tipo="soporte",
            titulo="Mensaje del equipo de Zarpi",
            mensaje=texto[:160],
            data={"conversacion_id": str(conversacion.id)},
            enlace_relativo="/chats",
        )

    db.commit()
    db.refresh(mensaje)

    remitente = db.query(Usuario).filter(Usuario.id == current_user["user_id"]).first()
    return MensajeAdminItem(
        id=str(mensaje.id),
        conversacion_id=str(mensaje.conversacion_id),
        remitente_id=str(mensaje.remitente_id),
        remitente_nombre=remitente.nombre if remitente else None,
        remitente_email=remitente.email if remitente else None,
        remitente_rol=remitente.rol if remitente else None,
        contenido=mensaje.contenido,
        tipo=str(mensaje.tipo),
        fecha_envio=mensaje.fecha_envio,
    )


@router.get("/metricas", response_model=MetricasResponse)
async def obtener_metricas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("admin"))
):
    """
    Métricas de éxito de la plataforma, según la sección "Métricas de éxito" del
    PDF de referencia: volumen de cotizaciones, tasa de respuesta de la red abierta,
    tiempo a primera propuesta, tasa de conversión a orden pagada, y salud de la red
    de importadores.
    """
    total_cotizaciones = db.query(Cotizacion).count()
    dirigidas = db.query(Cotizacion).filter(Cotizacion.modalidad == "dirigida").count()
    abiertas = db.query(Cotizacion).filter(Cotizacion.modalidad == "abierta").count()

    abiertas_con_propuesta = db.query(Cotizacion).filter(
        Cotizacion.modalidad == "abierta",
        Cotizacion.estado.in_([EstadoCotizacion.propuestas_recibidas.value, EstadoCotizacion.cotizacion_aceptada.value, EstadoCotizacion.orden_activa.value])
    ).count()
    tasa_respuesta = (abiertas_con_propuesta / abiertas * 100) if abiertas > 0 else 0.0

    # Tiempo promedio hasta la primera propuesta (en horas), calculado en Python
    # sobre un muestreo razonable, para mantener el query portable entre SQLite/MySQL.
    cotizaciones_con_propuestas = db.query(Cotizacion).join(Propuesta).limit(500).all()
    tiempos_horas = []
    for c in cotizaciones_con_propuestas:
        primera_propuesta = min(c.propuestas, key=lambda p: p.fecha_envio) if c.propuestas else None
        if primera_propuesta and c.fecha_creacion:
            delta = primera_propuesta.fecha_envio - c.fecha_creacion
            tiempos_horas.append(delta.total_seconds() / 3600)
    tiempo_promedio = (sum(tiempos_horas) / len(tiempos_horas)) if tiempos_horas else None

    propuestas_aceptadas = db.query(Propuesta).filter(Propuesta.estado == EstadoPropuesta.aceptada.value).count()
    ordenes_creadas = db.query(Orden).count()
    tasa_conversion = (ordenes_creadas / propuestas_aceptadas * 100) if propuestas_aceptadas > 0 else 0.0

    importadores_activos = db.query(Importador).filter(Importador.estado == "activo").count()
    importadores_verificados = db.query(Importador).filter(Importador.verificado == True).count()
    ordenes_en_disputa = db.query(Orden).filter(Orden.en_disputa == True).count()

    return MetricasResponse(
        total_cotizaciones=total_cotizaciones,
        cotizaciones_dirigidas=dirigidas,
        cotizaciones_abiertas=abiertas,
        tasa_respuesta_abiertas=round(tasa_respuesta, 2),
        tiempo_promedio_primera_propuesta_horas=round(tiempo_promedio, 2) if tiempo_promedio is not None else None,
        tasa_conversion_a_orden=round(tasa_conversion, 2),
        importadores_activos=importadores_activos,
        importadores_verificados=importadores_verificados,
        ordenes_en_disputa=ordenes_en_disputa
    )
