import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, object_session
from sqlalchemy import func, or_, and_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from uuid import UUID

import config
from schemas.cotizacion import (
    CotizacionCreate, CotizacionResponse, PropuestaCreate, PropuestaResponse,
    PropuestaAceptadaRequest, PreaceptarPropuestaRequest, ImportadorPendienteResponse, MatchingStatusResponse
)
from schemas.credito import SolicitarRecreacionRequest, SolicitudRecreacionResponse
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.usuario import Usuario
from models.propuesta import Propuesta, EstadoPropuesta
from models.importador import Importador
from utils.dependencies import get_db, get_current_user, require_rol, require_rol_in
from utils.categorias import categoria_en

logger = logging.getLogger("importacionesq8")

# Importar motor de matching (después de los routers para evitar circular imports)
matching_cotizacion_abierta = None

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite"""
    return column.like(f'%"{value}"%')

router = APIRouter(prefix="/cotizaciones", tags=["Cotizaciones"])

# Router independiente para /propuestas (no anidado bajo /cotizaciones) - ver Tarea 2.1
propuestas_router = APIRouter(prefix="/propuestas", tags=["Propuestas"])


MENSAJE_SIN_PUNTOS = "Nivel insuficiente y sin créditos"
MENSAJE_CUPO_AGOTADO = (
    "{empresa} alcanzó hoy su límite de cotizaciones recibidas. Elige otra empresa, "
    "publica la cotización en modalidad abierta o inténtalo de nuevo mañana."
)
MENSAJE_NO_ASIGNADA = "Esta solicitud abierta no está asignada a tu empresa."
MENSAJE_OMITIDA_POR_CUPO = (
    "Esta cotización abierta no se le entregó a tu empresa porque ese día ya había "
    "alcanzado su límite de cotizaciones diarias."
)


def _empresa_puede_responder_abierta(empresa: Optional[Importador], cotizacion: Cotizacion) -> bool:
    """¿Tiene sentido ofrecerle a esta empresa una cotización abierta ajena?

    Es el mismo criterio que aplica `POST /propuestas` al validar la propuesta,
    para que la bandeja de la empresa no muestre nada que después vaya a ser
    rechazado. Una empresa de "solo cotizaciones directas" queda fuera del
    circuito abierto por definición.
    """
    if empresa is None:
        return False
    if empresa.solo_cotizaciones_directas:
        return False
    return categoria_en(cotizacion.linea_producto, empresa.especialidad_producto)

def _vista_para_empresa(cotizacion: Cotizacion, importador_id: Optional[str]) -> CotizacionResponse:
    """La cotización tal como la puede ver una empresa: propuestas selladas.

    En una abierta varias empresas compiten, y la cotización arrastra datos de
    la que se movió primero (el asesor que la reclamó, su contacto, el chat).
    A las demás no se les enseñan: ni quién es la competencia ni que ya hay
    otra negociando.
    """
    vista = CotizacionResponse.model_validate(cotizacion)
    if cotizacion.modalidad != "abierta" or not importador_id:
        return vista

    from models.usuario import Usuario as UsuarioModel

    def es_de_mi_empresa(usuario_id: Optional[str]) -> bool:
        if not usuario_id:
            return False
        session = object_session(cotizacion)
        usuario = session.query(UsuarioModel).filter(UsuarioModel.id == str(usuario_id)).first() if session else None
        return bool(usuario and usuario.importador_id == importador_id)

    if not es_de_mi_empresa(vista.asesor_asignado_id):
        vista.asesor_asignado_id = None
        vista.conversacion_id = None
    if vista.contacto_asignado and not es_de_mi_empresa(vista.contacto_asignado.usuario_id):
        vista.contacto_asignado = None
    if cotizacion.importador_id and cotizacion.importador_id != importador_id:
        vista.importador_id = None
        vista.shipping_mark = None
    # Que ya haya propuestas de otras empresas también es información de la competencia.
    if vista.estado == EstadoCotizacion.propuestas_recibidas.value and not any(
        p.importador_id == importador_id and p.estado != EstadoPropuesta.borrador.value
        for p in cotizacion.propuestas
    ):
        vista.estado = EstadoCotizacion.abierta.value
    vista.motivo_eleccion = None
    vista.motivo_eleccion_detalle = None
    return vista


@router.get("", response_model=List[CotizacionResponse])
async def listar_cotizaciones(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista las cotizaciones del usuario autenticado.
    
    - Solicitante: solo sus propias cotizaciones
    - Importador: cotizaciones dirigidas a su empresa + cotizaciones abiertas que le aplican
    """
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    rol = current_user["rol"]
    
    if rol == "solicitante":
        # Solicitante ve solo sus propias cotizaciones
        cotizaciones = db.query(Cotizacion).filter(
            Cotizacion.solicitante_id == user_id_str
        ).order_by(Cotizacion.fecha_creacion.desc()).all()
    elif rol in ("importador", "asesor"):
        # El importador_id de la empresa viene del claim del JWT (no del user_id de
        # la cuenta), para soportar varias cuentas (dueño + asesores) por empresa.
        importador_id_str = current_user.get("importador_id")

        # Importador ve cotizaciones dirigidas a él + abiertas disponibles para propuestas
        cotizaciones = db.query(Cotizacion).filter(
            or_(
                Cotizacion.importador_id == importador_id_str,  # Dirigidas
                and_(
                    Cotizacion.modalidad == "abierta",
                    Cotizacion.estado.in_([
                        EstadoCotizacion.abierta.value,
                        EstadoCotizacion.propuestas_recibidas.value
                    ])
                )
            )
        ).order_by(Cotizacion.fecha_creacion.desc()).all()

        # Las abiertas se recortan a lo que la empresa puede responder de verdad.
        # Antes se devolvían todas: la bandeja se llenaba de cotizaciones de otras
        # categorías y el botón "Responder" terminaba en un 400 de congruencia que
        # el usuario leía como un fallo de permisos.
        # Y solo las que se le asignaron: cada abierta llega a un máximo de
        # empresas elegidas por encaje (services/asignacion.py), no a toda la red.
        from services.asignacion import cotizaciones_asignadas

        empresa = db.query(Importador).filter(Importador.id == importador_id_str).first()
        asignadas = cotizaciones_asignadas(db, importador_id_str)
        cotizaciones = [
            c for c in cotizaciones
            if c.importador_id == importador_id_str
            or (str(c.id) in asignadas and _empresa_puede_responder_abierta(empresa, c))
        ]
        return [_vista_para_empresa(c, importador_id_str) for c in cotizaciones]
    else:
        # Admin ve todas las cotizaciones
        cotizaciones = db.query(Cotizacion).order_by(
            Cotizacion.fecha_creacion.desc()
        ).limit(50).all()
    
    return cotizaciones

# ==================== Pool de cotizaciones de la empresa y reclamo (Fase 1) ====================
# NOTA: "/pool-empresa" es un segmento literal y debe registrarse ANTES de
# "/{cotizacion_id}" para que FastAPI no lo capture como un cotizacion_id.

@router.get("/pool-empresa", response_model=List[CotizacionResponse])
async def listar_pool_empresa(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor"))
):
    """
    Pool de cotizaciones de la empresa (dirigidas a ella, o abiertas que tiene
    asignadas) que todavía nadie ha reclamado. La cuenta dueña (representante
    legal) y los asesores pueden verlo; cualquiera de ellos puede reclamar
    (`POST /reclamar`) — el primero se la queda.
    """
    importador_id_str = current_user.get("importador_id")
    if not importador_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no está asociada a ninguna empresa importadora"
        )

    query = db.query(Cotizacion).filter(
        Cotizacion.asesor_asignado_id.is_(None),
        or_(
            Cotizacion.importador_id == importador_id_str,
            and_(
                Cotizacion.modalidad == "abierta",
                Cotizacion.estado.in_([
                    EstadoCotizacion.abierta.value,
                    EstadoCotizacion.propuestas_recibidas.value
                ])
            )
        )
    )

    cotizaciones_candidatas = query.order_by(Cotizacion.fecha_creacion.desc()).all()

    from services.asignacion import cotizaciones_asignadas

    asignadas = cotizaciones_asignadas(db, importador_id_str)
    return [
        _vista_para_empresa(c, importador_id_str) for c in cotizaciones_candidatas
        if c.importador_id == importador_id_str or str(c.id) in asignadas
    ]

def _asegurar_chat_negociacion(
    db: Session,
    *,
    cotizacion: Cotizacion,
    importador_usuario_id: str,
    mensaje_sistema: Optional[str] = None,
):
    """Devuelve el hilo solicitante ↔ empresa de esta cotización, creándolo si no existe.

    Hay tres momentos que necesitan el hilo abierto (el asesor reclama, el
    cliente pide negociar, la propuesta se cierra) y antes cada uno lo creaba por
    su cuenta con criterios ligeramente distintos. Con un único sitio, el hilo
    siempre nace igual y nunca se duplica: `cotizacion_id` es único en la tabla.
    """
    from uuid import uuid4 as gen_uuid

    from models.chat import ConversacionChat, MensajeChat, TipoConversacion, TipoMensajeChat

    conversacion = db.query(ConversacionChat).filter(
        ConversacionChat.cotizacion_id == cotizacion.id
    ).first()

    if conversacion:
        return conversacion

    conversacion = ConversacionChat(
        id=str(gen_uuid()),
        tipo=TipoConversacion.negociacion.value,
        cotizacion_id=cotizacion.id,
        solicitante_id=cotizacion.solicitante_id,
        importador_usuario_id=importador_usuario_id,
    )
    db.add(conversacion)
    db.flush()

    if mensaje_sistema:
        db.add(MensajeChat(
            id=str(gen_uuid()),
            conversacion_id=conversacion.id,
            remitente_id=importador_usuario_id,
            contenido=mensaje_sistema,
            tipo=TipoMensajeChat.sistema.value,
        ))

    return conversacion


@router.post("/{cotizacion_id}/reclamar", response_model=CotizacionResponse)
async def reclamar_cotizacion(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor"))
):
    """
    Reclamo atómico de una cotización del pool de la empresa: "el primero que hace
    clic se la queda". Pueden reclamar el **dueño** (representante legal / jefe de
    operadores) o un **asesor**. La atomicidad real la da el UPDATE condicional
    (no un check-then-set en Python).
    """
    importador_id_str = current_user.get("importador_id")
    if not importador_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no está asociada a ninguna empresa importadora"
        )

    try:
        cotizacion_id_str = str(UUID(cotizacion_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de cotización inválido")

    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id_str).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    # La cotización debe pertenecer a la empresa (dirigida) o ser abierta;
    # en ambos casos debe seguir sin reclamar.
    if cotizacion.importador_id and cotizacion.importador_id != importador_id_str:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado - Cotización de otra empresa")
    _validar_asignada(cotizacion, importador_id_str, db)

    user_id_str = str(UUID(current_user["user_id"]))

    # UPDATE condicional: solo tiene efecto si asesor_asignado_id sigue NULL.
    # rowcount == 0 significa que otro miembro la reclamó primero (o ya no existe).
    resultado = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.asesor_asignado_id.is_(None)
    ).update({"asesor_asignado_id": user_id_str}, synchronize_session=False)

    if resultado == 0:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta cotización ya fue reclamada por otro miembro de la empresa"
        )

    # El chat nace aquí, no cuando el cliente se decide a escribir: quien reclama
    # es quien va a negociar, y sin canal abierto el solicitante no tenía forma
    # de discutir condiciones antes de aceptar.
    from models.usuario import Usuario

    quien = db.query(Usuario).filter(Usuario.id == user_id_str).first()
    empresa = db.query(Importador).filter(Importador.id == importador_id_str).first()
    nombre_quien = (quien.nombre or quien.email) if quien else "Un asesor"
    nombre_empresa = empresa.nombre_empresa if empresa else "la empresa importadora"

    conversacion = _asegurar_chat_negociacion(
        db,
        cotizacion=cotizacion,
        importador_usuario_id=user_id_str,
        mensaje_sistema=(
            f"{nombre_quien}, de {nombre_empresa}, tomó esta cotización y abrió el "
            f"canal para negociar las condiciones."
        ),
    )

    from services.notificacion_service import notificar as _notificar_usuario

    _notificar_usuario(
        db,
        usuario_id=cotizacion.solicitante_id,
        tipo="negociacion",
        titulo="Un asesor tomó tu cotización",
        mensaje=(
            f"{nombre_quien} ({nombre_empresa}) atenderá «{cotizacion.nombre_producto}». "
            f"Ya puedes escribirle por el chat."
        ),
        # `conversacion_id` permite abrir el chat directo desde la notificación
        # (y queda como columna en la tabla). Se emite en tiempo real tras el commit.
        data={
            "cotizacion_id": cotizacion_id_str,
            "importador_id": importador_id_str,
            "conversacion_id": str(conversacion.id),
        },
        enlace_relativo="/chats",
    )

    # Quien reclama ya la vio, aunque haya sido desde la lista.
    from services.eventos import registrar_vista

    registrar_vista(db, cotizacion, importador_id=importador_id_str, usuario=current_user)

    db.commit()
    db.refresh(cotizacion)

    return _vista_para_empresa(cotizacion, importador_id_str)

@router.post("/{cotizacion_id}/vista", status_code=status.HTTP_204_NO_CONTENT)
async def marcar_cotizacion_vista(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
):
    """La empresa abrió la solicitud. Solo cuenta la primera vez (evento
    `solicitud_vista`); de ahí sale cuánto tarda en mirarla."""
    from services.asignacion import esta_asignada
    from services.eventos import registrar_vista

    try:
        cotizacion_id_str = str(UUID(cotizacion_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de cotización inválido")
    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id_str).first()
    importador_id = current_user.get("importador_id")
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")
    if cotizacion.importador_id != importador_id and not (
        cotizacion.modalidad == "abierta" and esta_asignada(db, importador_id, cotizacion.id)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta cotización")
    if registrar_vista(db, cotizacion, importador_id=importador_id, usuario=current_user):
        db.commit()


@router.get("/{cotizacion_id}", response_model=CotizacionResponse)
async def obtener_cotizacion(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene los detalles de una cotización específica. Solo si el usuario tiene acceso.
    
    - **cotizacion_id**: ID de la cotización (UUID)
    """
    try:
        # Validar que el ID sea un UUID válido
        cotizacion_id_str = str(UUID(cotizacion_id))  # Convertir a string para SQLite
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str  # Usar string para SQLite
    ).first()
    
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada"
        )
    
    # Verificar que el usuario tiene acceso a esta cotización
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    rol = current_user["rol"]
    
    if rol == "solicitante" and cotizacion.solicitante_id != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta cotización"
        )
    
    # Importador/asesor solo puede ver si es dirigida a su empresa o es una
    # abierta que tiene asignada.
    if rol in ("importador", "asesor") and cotizacion.importador_id != current_user.get("importador_id"):
        from services.asignacion import esta_asignada

        if cotizacion.modalidad != "abierta" or not esta_asignada(db, current_user.get("importador_id"), cotizacion.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a esta cotización"
            )

    # Primera vez que la empresa abre la solicitud: es el "vista" de la
    # bitácora, y de ahí sale el tiempo que tarda en mirarla.
    if rol in ("importador", "asesor"):
        from services.eventos import registrar_vista

        if registrar_vista(db, cotizacion, importador_id=current_user.get("importador_id"), usuario=current_user):
            db.commit()
            db.refresh(cotizacion)
        return _vista_para_empresa(cotizacion, current_user.get("importador_id"))

    return cotizacion

@router.post("", response_model=CotizacionResponse, status_code=status.HTTP_201_CREATED)
async def crear_cotizacion(
    cotizacion_data: CotizacionCreate,
    current_user: dict = Depends(require_rol("solicitante")),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva cotización. Solo los solicitantes pueden crear cotizaciones.
    
    - **modalidad**: "dirigida" o "abierta"
    - **importador_id**: Solo para modalidad dirigida (opcional para abierta)
    - **pais_importacion**: País desde donde se importa
    - **nombre_producto**: Nombre del producto a importar
    - **descripcion_cliente**: Descripción detallada del producto
    - **linea_producto**: Categoría/línea del producto
    - **tipo_calidad**: Tipo de calidad ("economica", "estandar", "premium")
    - **cantidad_minima**: Cantidad mínima a importar
    - **incoterm**: Incoterm acordado (FOB, CIF, etc.)
    """
    from uuid import uuid4
    from models.usuario import Usuario

    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite

    solicitante = db.query(Usuario).filter(Usuario.id == user_id_str).first()
    if not solicitante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    # El tier exigido sale de la empresa destino, nunca del payload: si lo
    # decidiera el cliente bastaría con mandar "Bronze" para saltarse el bloqueo.
    tier_requerido = "Bronze"
    requiere_desbloqueo = False

    # Modelo actual: no se cobra al solicitante (natural/jurídica).
    # Si COBRO_A_SOLICITANTES=true, se restaura el débito de créditos al crear.
    if config.COBRO_A_SOLICITANTES:
        from services.credito_wallet import obtener_wallet, debitar_atomico

        costo_creditos = (
            config.CREDITO_COSTO_COTIZACION_ABIERTA if cotizacion_data.modalidad == "abierta"
            else config.CREDITO_COSTO_COTIZACION_DIRIGIDA
        )
        wallet = obtener_wallet(db, solicitante)
        if wallet.balance < costo_creditos:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=(
                    f"Créditos insuficientes: se necesitan {costo_creditos} créditos para crear esta "
                    f"cotización (saldo actual: {wallet.balance}). Compra créditos en "
                    f"POST /creditos/comprar"
                )
            )
    else:
        costo_creditos = 0.0
        wallet = None

    # Validar modalidad dirigida
    if cotizacion_data.modalidad == "dirigida" and not cotizacion_data.importador_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La modalidad dirigida requiere un importador_id"
        )
    
    # Validar que el importador exista si es dirigida
    if cotizacion_data.modalidad == "dirigida" and cotizacion_data.importador_id:
        try:
            importador_id_str = str(UUID(cotizacion_data.importador_id))  # Convertir a string para SQLite
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID de importador inválido"
            )
        
        from models.importador import Importador
        importador = db.query(Importador).filter(
            Importador.id == importador_id_str,  # Usar string para SQLite
            Importador.estado == "activo"
        ).first()
        
        if not importador:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Importador no encontrado o inactivo"
            )

        # La empresa destino tiene que trabajar la línea de producto pedida. Sin
        # esta comprobación la cotización se creaba igual y era la empresa quien
        # se topaba después con el 400 de congruencia al intentar responder: un
        # callejón sin salida para las dos partes. Mejor decírselo al cliente
        # ahora, que todavía puede elegir otra empresa o la modalidad abierta.
        if not categoria_en(cotizacion_data.linea_producto, importador.especialidad_producto):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{importador.nombre_empresa} no trabaja la línea de producto "
                    f"'{cotizacion_data.linea_producto}'. Elige otra empresa o publica la "
                    f"cotización en modalidad abierta."
                )
            )

        # Si la empresa es de "solo cotizaciones directas", validar que se hayan
        # incluido los valores de sus campos personalizados obligatorios.
        if importador.solo_cotizaciones_directas:
            from models.campo_personalizado import CampoPersonalizado
            campos_obligatorios = db.query(CampoPersonalizado).filter(
                CampoPersonalizado.importador_id == importador_id_str,
                CampoPersonalizado.obligatorio == True
            ).all()
            valores = cotizacion_data.campos_personalizados_valores or {}
            faltantes = [c.etiqueta for c in campos_obligatorios if not valores.get(str(c.id))]
            if faltantes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Faltan campos obligatorios del formulario de la empresa: {', '.join(faltantes)}"
                )

        # Cupo diario de la empresa. Se bloquea su fila para que dos cotizaciones
        # simultáneas no pasen las dos con el último hueco libre; la recepción se
        # registra en esta misma transacción.
        if importador.limite_cotizaciones_diarias is not None:
            from services.cupo_cotizaciones import cupo_agotado, recibidas_hoy

            db.query(Importador).filter(Importador.id == importador_id_str).with_for_update().first()
            recibidas = recibidas_hoy(db, [importador_id_str]).get(importador_id_str, 0)
            if cupo_agotado(importador.limite_cotizaciones_diarias, recibidas):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=MENSAJE_CUPO_AGOTADO.format(empresa=importador.nombre_empresa),
                )

        from services.tier_service import tier_insuficiente

        tier_requerido = importador.tier_minimo_requerido or "Bronze"
        requiere_desbloqueo = tier_insuficiente(solicitante.tier, tier_requerido)
        if requiere_desbloqueo and int(solicitante.puntos_cotizacion or 0) < 1:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MENSAJE_SIN_PUNTOS)

    # Crear nueva cotización - usar el importador_id como string directamente
    nuevo_cotizacion = Cotizacion(
        id=str(uuid4()),  # Convertir a string para SQLite
        solicitante_id=user_id_str,
        importador_id=cotizacion_data.importador_id if cotizacion_data.importador_id else None,
        campos_personalizados_valores=cotizacion_data.campos_personalizados_valores,
        modalidad=cotizacion_data.modalidad,
        tier_minimo_requerido=tier_requerido,
        tier_solicitante_creacion=solicitante.tier,
        desbloqueada_por_puntos=requiere_desbloqueo,
        foto_producto=cotizacion_data.foto_producto,
        pais_importacion=cotizacion_data.pais_importacion,
        nivel_personalizacion=cotizacion_data.nivel_personalizacion,
        nombre_producto=cotizacion_data.nombre_producto,
        descripcion_cliente=cotizacion_data.descripcion_cliente,
        link_referencia=cotizacion_data.link_referencia,
        linea_producto=cotizacion_data.linea_producto,
        tipo_calidad=cotizacion_data.tipo_calidad,
        modalidad_importacion=cotizacion_data.modalidad_importacion,
        cantidad_minima=cotizacion_data.cantidad_minima,
        unidad_cantidad=cotizacion_data.unidad_cantidad,
        precio_objetivo_usd=cotizacion_data.precio_objetivo_usd,
        moneda_precio_objetivo=(cotizacion_data.precio_objetivo_moneda or "USD").upper(),
        incoterm=(cotizacion_data.incoterm or "DDP").upper(),
        notas_adicionales=cotizacion_data.notas_adicionales,
        shipping_mark_sufijo=cotizacion_data.shipping_mark_sufijo,
        costo_creditos=costo_creditos,
        estado="dirigida" if cotizacion_data.modalidad == "dirigida" else "abierta"
    )
    
    db.add(nuevo_cotizacion)
    db.flush()

    from services.eventos import TiposEvento, evento_solicitud

    evento_solicitud(
        db, TiposEvento.SOLICITUD_CREADA, nuevo_cotizacion, usuario=current_user,
        estado_nuevo=nuevo_cotizacion.estado,
    )

    if nuevo_cotizacion.modalidad == "dirigida" and nuevo_cotizacion.importador_id:
        from services.cupo_cotizaciones import registrar_recepcion

        registrar_recepcion(
            db,
            importador_id=str(UUID(nuevo_cotizacion.importador_id)),
            cotizacion_id=nuevo_cotizacion.id,
            modalidad="dirigida",
        )

    if config.COBRO_A_SOLICITANTES and wallet is not None and costo_creditos > 0:
        from services.credito_wallet import debitar_atomico

        debitar_atomico(
            db,
            wallet,
            costo_creditos,
            cotizacion_id=nuevo_cotizacion.id,
            descripcion=f"Creación de cotización {cotizacion_data.modalidad}",
        )

    if requiere_desbloqueo:
        from services.tier_service import SinPuntosParaDesbloquear, consumir_punto_desbloqueo

        # Se gasta en la misma transacción que crea la cotización: o quedan las
        # dos cosas, o ninguna. La comprobación previa de saldo solo ahorra el
        # trabajo; la garantía real es el UPDATE condicional.
        db.flush()
        try:
            consumir_punto_desbloqueo(db, usuario_id=user_id_str, cotizacion_id=nuevo_cotizacion.id)
        except SinPuntosParaDesbloquear:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MENSAJE_SIN_PUNTOS)

    from services.tier_service import recalcular_tier_best_effort

    recalcular_tier_best_effort(db, user_id_str)

    db.commit()
    db.refresh(nuevo_cotizacion)
    db.refresh(solicitante)
    
    # Si es cotización abierta, ejecutar el motor de matching (después del commit para tener ID)
    importadores_notificables = []
    if cotizacion_data.modalidad == "abierta":
        from services.matching_service import matching_cotizacion_abierta as mc
        importadores_notificables = mc(
            str(nuevo_cotizacion.id),
            nuevo_cotizacion.pais_importacion,
            nuevo_cotizacion.linea_producto,
            db
        ) or []

    # Aviso a las empresas que pueden responderla (in-app + WhatsApp + correo).
    try:
        _notificar_cotizacion_en_pool(db, cotizacion=nuevo_cotizacion, importadores=importadores_notificables)
        db.commit()
    except Exception:
        db.rollback()
        logger.warning("No se pudo notificar la nueva cotización %s a las empresas", nuevo_cotizacion.id)

    return nuevo_cotizacion

# ==================== Endpoints de Propuestas (Tarea 2.1) ====================

def _validar_asignada(cotizacion: Cotizacion, importador_id_str: str, db: Session):
    """Una abierta solo la responde una empresa a la que se le asignó.

    La fuente de verdad es `recepciones_cotizacion` (ver services/asignacion.py),
    no Redis: así la regla es la misma en producción y en desarrollo, y no
    depende de que Redis siga teniendo el reparto.
    """
    from services.asignacion import esta_asignada
    from services.cupo_cotizaciones import fue_omitida

    if cotizacion.modalidad != "abierta":
        return
    if fue_omitida(db, importador_id_str, str(cotizacion.id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MENSAJE_OMITIDA_POR_CUPO)
    if not esta_asignada(db, importador_id_str, str(cotizacion.id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MENSAJE_NO_ASIGNADA)


def _validar_congruencia_categoria(cotizacion: Cotizacion, importador_id_str: str, db: Session):
    """
    Una empresa importadora solo puede responder cotizaciones de su propia
    especialidad (ej. una empresa de tecnología no puede responder una
    cotización de alimentos y viceversa). Se aplica tanto a propuestas
    dirigidas como a propuestas sobre cotizaciones abiertas.

    La comparación es tolerante a mayúsculas, tildes, plurales y variantes
    léxicas (`utils.categorias`): el formulario de cotización y el perfil de
    empresa llegaron a ofrecer listas distintas ("Químicos" / "Química"), y con
    igualdad exacta la empresa veía la cotización pero no podía responderla.
    """
    importador_empresa = db.query(Importador).filter(Importador.id == importador_id_str).first()
    especialidades = (importador_empresa.especialidad_producto or []) if importador_empresa else []
    if not categoria_en(cotizacion.linea_producto, especialidades):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"La categoría de la cotización ('{cotizacion.linea_producto}') no es congruente con la "
                f"especialidad de tu empresa. Solo puedes responder cotizaciones de tu(s) especialidad(es)."
            )
        )


# ==================== Notificaciones de negocio (in-app + WhatsApp + correo) ====================

def _cuentas_de_empresa(db: Session, importador_id: Optional[str]) -> List:
    """Dueño y asesores activos de una empresa: los destinatarios de sus avisos."""
    from models.usuario import Usuario as UsuarioModel

    if not importador_id:
        return []
    return db.query(UsuarioModel).filter(
        UsuarioModel.importador_id == importador_id,
        UsuarioModel.rol.in_(("importador", "asesor")),
        UsuarioModel.activo.is_(True),
    ).all()


def _nombre_empresa(db: Session, importador_id: Optional[str]) -> str:
    if not importador_id:
        return "Una empresa importadora"
    empresa = db.query(Importador).filter(Importador.id == importador_id).first()
    return empresa.nombre_empresa if empresa else "Una empresa importadora"


def _notificar_propuesta_enviada(db: Session, *, cotizacion: Cotizacion, importador_id: Optional[str]) -> None:
    """Avisa al solicitante de que recibió una propuesta nueva."""
    from services.notificacion_service import notificar

    notificar(
        db,
        usuario_id=cotizacion.solicitante_id,
        tipo="propuesta",
        titulo="Nueva propuesta recibida",
        mensaje=(
            f"{_nombre_empresa(db, importador_id)} respondió tu cotización "
            f"de {cotizacion.nombre_producto}."
        ),
        data={"cotizacion_id": str(cotizacion.id), "importador_id": importador_id},
        enlace_relativo="/cotizaciones",
    )


def _notificar_empresa(
    db: Session,
    *,
    importador_id: Optional[str],
    tipo: str,
    titulo: str,
    mensaje: str,
    data: Optional[dict] = None,
    enlace_relativo: str = "",
    solo_usuario_id: Optional[str] = None,
) -> None:
    """Avisa a la empresa. Si hay un responsable asignado, solo a él."""
    from services.notificacion_service import notificar

    if solo_usuario_id:
        notificar(
            db,
            usuario_id=solo_usuario_id,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            data=data,
            enlace_relativo=enlace_relativo,
        )
        return

    for cuenta in _cuentas_de_empresa(db, importador_id):
        notificar(
            db,
            usuario_id=str(cuenta.id),
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            data=data,
            enlace_relativo=enlace_relativo,
        )


def _notificar_cotizacion_en_pool(db: Session, *, cotizacion: Cotizacion, importadores: List) -> None:
    """Avisa a las empresas que pueden responder una cotización recién creada."""
    destino = [str(imp.id) for imp in importadores] if importadores else []
    if cotizacion.modalidad == "dirigida" and cotizacion.importador_id:
        destino = [str(cotizacion.importador_id)]

    etiqueta = "dirigida a tu empresa" if cotizacion.modalidad == "dirigida" else "abierta que encaja con tu especialidad"
    for importador_id in destino:
        _notificar_empresa(
            db,
            importador_id=importador_id,
            tipo="cotizacion",
            titulo="Nueva cotización disponible",
            mensaje=f"Cotización {etiqueta}: {cotizacion.nombre_producto}.",
            data={"cotizacion_id": str(cotizacion.id), "modalidad": cotizacion.modalidad},
            enlace_relativo="/cotizaciones",
        )


@propuestas_router.post("", response_model=PropuestaResponse, status_code=status.HTTP_201_CREATED)
async def enviar_propuesta(
    propuesta: PropuestaCreate,
    current_user: dict = Depends(require_rol("importador")),
    db: Session = Depends(get_db)
):
    """
    Enviar una propuesta directamente (sin pasar por borrador). Solo la cuenta
    dueña de la empresa puede enviar propuestas directamente; un asesor debe
    redactarla primero como borrador (`POST /propuestas/borrador`) y esta misma
    cuenta dueña la envía después (`POST /propuestas/{id}/enviar`).
    
    - **cotizacion_id**: ID de la cotización a la que responde
    - **precio_ofrecido_usd**: Precio ofrecido por el importador
    - **tiempo_estimado_entrega**: Tiempo estimado (ej: "45 días")
    - **incoterm**: Incoterm propuesto (FOB, CIF, EXW, DDP, etc.)
    - **condiciones_adicionales**: Condiciones adicionales (opcional)
    
    Validaciones:
    1. La cotización debe existir y estar abierta a propuestas (abierta/propuestas_recibidas) o dirigida a tu empresa
    2. Si es abierta: la solicitud debe estar asignada a tu empresa
    3. La categoría de la cotización debe ser congruente con la especialidad de tu empresa
    4. El importador no puede enviar más de una propuesta por cotización
    """
    from uuid import UUID as PyUUID, uuid4
    
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite

    # La propuesta se registra a nombre de la empresa (Importador.id), no de la
    # cuenta de usuario que la envía, para que sea visible/consistente sin importar
    # qué cuenta (siempre la dueña, según reglas de negocio) la haya enviado.
    importador_id_str = current_user.get("importador_id")
    if not importador_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta no está asociada a ninguna empresa importadora"
        )
    
    # 1. Verificar que la cotización existe y está abierta a propuestas (o es dirigida a esta empresa)
    try:
        cotizacion_id_str = str(PyUUID(propuesta.cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.estado.in_(["abierta", "propuestas_recibidas", "dirigida"])
    ).first()
    
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada o no está abierta a propuestas"
        )

    if cotizacion.modalidad == "dirigida":
        if cotizacion.importador_id != importador_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta cotización no está dirigida a tu empresa"
            )
    # 2. En las abiertas, la solicitud tiene que estar asignada a la empresa
    # (lo comprueba `_validar_asignada`, abajo).
    # 2.5. Congruencia de categoría: la especialidad de la empresa debe incluir la línea de producto solicitada
    _validar_asignada(cotizacion, importador_id_str, db)
    _validar_congruencia_categoria(cotizacion, importador_id_str, db)

    # 3. Verificar que el importador no ha enviado ya una propuesta a esta cotización
    propuesta_existente = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.importador_id == importador_id_str
    ).first()
    
    if propuesta_existente:
        # Distinguir el borrador de un asesor de una propuesta ya enviada: decir
        # "ya has enviado una propuesta" cuando lo que hay es un borrador ajeno
        # dejaba al dueño sin entender qué hacer (el camino es revisarlo y
        # enviarlo con POST /propuestas/{id}/enviar).
        if propuesta_existente.estado == EstadoPropuesta.borrador.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Tu empresa ya tiene un borrador de propuesta para esta cotización. "
                    "Revísalo y envíalo desde el panel en lugar de crear otro."
                )
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya has enviado una propuesta a esta cotización"
        )

    # 3.5. El dueño queda como responsable de la cotización que acaba de responder.
    # Sin esto la cotización seguía con `asesor_asignado_id` NULL y por tanto
    # visible en `GET /cotizaciones/pool-empresa`: cualquier asesor podía
    # reclamarla después y quedarse con el chat de una propuesta que no escribió.
    if not cotizacion.asesor_asignado_id:
        cotizacion.asesor_asignado_id = user_id_str

    # 4. Crear nueva propuesta en la base de datos
    nueva_propuesta = Propuesta(
        id=str(uuid4()),  # Convertir a string para SQLite
        cotizacion_id=cotizacion_id_str,
        importador_id=importador_id_str,
        precio_ofrecido_usd=propuesta.precio_ofrecido_usd,
        tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
        incoterm=propuesta.incoterm,
        condiciones_adicionales=propuesta.condiciones_adicionales,
        cantidad=propuesta.cantidad,
        estado=EstadoPropuesta.pendiente,
        creado_por_usuario_id=user_id_str
    )
    db.add(nueva_propuesta)

    from services.eventos import TiposEvento, evento_propuesta

    evento_propuesta(
        db, TiposEvento.PROPUESTA_ENVIADA, nueva_propuesta, cotizacion, usuario=current_user,
        estado_nuevo=EstadoPropuesta.pendiente.value,
    )

    # 5. Actualizar estado de la cotización a "propuestas_recibidas" al recibir la primera propuesta
    # (aplica a abierta Y dirigida; sin esto, negociar/aceptar falla en dirigidas).
    if cotizacion.estado in ("abierta", "dirigida", EstadoCotizacion.abierta.value, EstadoCotizacion.dirigida.value):
        cotizacion.estado = EstadoCotizacion.propuestas_recibidas
    
    # 6. Confirmar en una única transacción atómica (ACID). La restricción única
    # unique_propuesta_cotizacion_importador es la garantía real contra condiciones
    # de carrera cuando dos solicitudes concurrentes pasan el check del paso 3 a la vez.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya has enviado una propuesta a esta cotización"
        )
    db.refresh(nueva_propuesta)

    # El aviso va después del commit: en la carrera por la restricción única se
    # hace rollback, y no debe salir un correo por una propuesta que no existe.
    try:
        _notificar_propuesta_enviada(db, cotizacion=cotizacion, importador_id=importador_id_str)
        db.commit()
    except Exception:
        db.rollback()
        logger.warning("No se pudo notificar la propuesta enviada de %s", importador_id_str)
    
    # 7. Actualizar estado en Redis (best-effort, después de confirmar en la base de datos).
    # Si Redis falla aquí ya no se debe revertir la propuesta, que ya quedó persistida en MySQL/SQLite.
    if config.redis_client:
        try:
            config.redis_client.hset(f"cotizacion_abierta:{cotizacion_id_str}", importador_id_str, "respondido")
            config.redis_client.incr(f"cotizacion_abierta:{cotizacion_id_str}:respuestas")
        except Exception:
            logger.warning("No se pudo actualizar el estado de matching en Redis para %s", cotizacion_id_str)
    
    return PropuestaResponse(
        id=str(nueva_propuesta.id),
        cotizacion_id=propuesta.cotizacion_id,
        importador_id=importador_id_str,
        precio_ofrecido_usd=nueva_propuesta.precio_ofrecido_usd,
        tiempo_estimado_entrega=nueva_propuesta.tiempo_estimado_entrega,
        incoterm=nueva_propuesta.incoterm,
        condiciones_adicionales=nueva_propuesta.condiciones_adicionales,
        estado=nueva_propuesta.estado.value if isinstance(nueva_propuesta.estado, EstadoPropuesta) else nueva_propuesta.estado,
        creado_por_usuario_id=nueva_propuesta.creado_por_usuario_id,
        cantidad=nueva_propuesta.cantidad,
        fecha_envio=nueva_propuesta.fecha_envio,
        contacto_asesor=nueva_propuesta.contacto_asesor
    )

# ==================== Borrador (asesor) / envío (dueño) de propuestas (Fase 4) ====================

@propuestas_router.post("/borrador", response_model=PropuestaResponse, status_code=status.HTTP_201_CREATED)
async def crear_borrador_propuesta(
    propuesta: PropuestaCreate,
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
    db: Session = Depends(get_db)
):
    """
    Redacta un borrador de propuesta para una cotización de la empresa.

    Un **asesor** solo puede redactar sobre lo que reclamó
    (`POST /cotizaciones/{id}/reclamar`). El **dueño** puede redactar sobre
    cualquier cotización de su empresa: también reclama cotizaciones, y limitar
    este endpoint al rol "asesor" lo dejaba con un 403 sobre su propio trabajo.

    El borrador no es visible para el solicitante hasta que la cuenta dueña lo
    envíe (`POST /propuestas/{id}/enviar`).
    """
    from uuid import UUID as PyUUID, uuid4

    user_id_str = str(PyUUID(current_user["user_id"]))
    importador_id_str = current_user.get("importador_id")
    if not importador_id_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cuenta no está asociada a ninguna empresa importadora")

    try:
        cotizacion_id_str = str(PyUUID(propuesta.cotizacion_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de cotización inválido")

    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id_str).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    if current_user["rol"] == "asesor":
        # El asesor solo redacta sobre lo que reclamó.
        if cotizacion.asesor_asignado_id != user_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo puedes redactar propuestas de cotizaciones que hayas reclamado"
            )
    else:
        # El dueño redacta sobre cualquier cotización de su empresa; en dirigidas
        # se comprueba que efectivamente vaya destinada a ella.
        if cotizacion.modalidad == "dirigida" and cotizacion.importador_id != importador_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta cotización no está dirigida a tu empresa"
            )
        # Si nadie la había reclamado, el dueño queda como responsable: así sale
        # del pool y ningún asesor puede reclamarla por encima de su borrador.
        if not cotizacion.asesor_asignado_id:
            cotizacion.asesor_asignado_id = user_id_str

    _validar_asignada(cotizacion, importador_id_str, db)

    propuesta_existente = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.importador_id == importador_id_str
    ).first()
    if propuesta_existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya existe una propuesta (borrador o enviada) de tu empresa para esta cotización")

    nuevo_borrador = Propuesta(
        id=str(uuid4()),
        cotizacion_id=cotizacion_id_str,
        importador_id=importador_id_str,
        precio_ofrecido_usd=propuesta.precio_ofrecido_usd,
        tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
        incoterm=propuesta.incoterm,
        condiciones_adicionales=propuesta.condiciones_adicionales,
        cantidad=propuesta.cantidad,
        estado=EstadoPropuesta.borrador,
        creado_por_usuario_id=user_id_str
    )
    db.add(nuevo_borrador)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ya existe una propuesta de tu empresa para esta cotización")
    db.refresh(nuevo_borrador)

    return nuevo_borrador


@propuestas_router.put("/{propuesta_id}", response_model=PropuestaResponse)
async def editar_propuesta(
    propuesta_id: str,
    propuesta: PropuestaCreate,
    current_user: dict = Depends(require_rol_in("asesor", "importador")),
    db: Session = Depends(get_db)
):
    """
    Edita una propuesta propia (de tu empresa) mientras siga en borrador, o ya
    enviada (`pendiente`) para reflejar ajustes negociados por chat con el
    solicitante. No se puede editar una propuesta ya aceptada o rechazada.
    """
    from uuid import UUID as PyUUID

    try:
        propuesta_id_str = str(PyUUID(propuesta_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")

    propuesta_db = db.query(Propuesta).filter(Propuesta.id == propuesta_id_str).first()
    if not propuesta_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")

    if propuesta_db.importador_id != current_user.get("importador_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre esta propuesta")

    if propuesta_db.estado not in (EstadoPropuesta.borrador.value, EstadoPropuesta.pendiente.value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se puede editar una propuesta en borrador o pendiente")

    propuesta_db.precio_ofrecido_usd = propuesta.precio_ofrecido_usd
    propuesta_db.tiempo_estimado_entrega = propuesta.tiempo_estimado_entrega
    propuesta_db.incoterm = propuesta.incoterm
    propuesta_db.condiciones_adicionales = propuesta.condiciones_adicionales
    if propuesta.cantidad is not None:
        propuesta_db.cantidad = propuesta.cantidad
    propuesta_db.creado_por_usuario_id = str(PyUUID(current_user["user_id"]))
    # Una edición reinicia la pre-aceptación mutua: cualquier cambio debe volver a confirmarse
    propuesta_db.preaceptada_por_solicitante = False
    propuesta_db.preaceptada_por_empresa = False

    # Solo cuenta para la bitácora lo que ve el cliente: retocar un borrador no
    # cambia nada del negocio todavía.
    if propuesta_db.estado == EstadoPropuesta.pendiente.value:
        # El comprador ya la tenía delante: se lleva la cuenta para poder
        # decirle que lo que compara no es la oferta que llegó.
        propuesta_db.revisiones = (propuesta_db.revisiones or 0) + 1
        propuesta_db.fecha_modificacion = datetime.utcnow()

        from services.eventos import TiposEvento, evento_propuesta

        cotizacion = db.query(Cotizacion).filter(Cotizacion.id == propuesta_db.cotizacion_id).first()
        if cotizacion is not None:
            evento_propuesta(
                db, TiposEvento.PROPUESTA_EDITADA, propuesta_db, cotizacion, usuario=current_user,
                estado_nuevo=EstadoPropuesta.pendiente.value,
            )

    db.commit()
    db.refresh(propuesta_db)

    return propuesta_db


@propuestas_router.post("/{propuesta_id}/enviar", response_model=PropuestaResponse)
async def enviar_borrador_propuesta(
    propuesta_id: str,
    current_user: dict = Depends(require_rol("importador")),
    db: Session = Depends(get_db)
):
    """
    La cuenta dueña envía un borrador redactado por un asesor (o por ella misma)
    al solicitante, previa validación de congruencia de categoría. A partir de
    aquí la propuesta es visible para el solicitante.
    """
    from uuid import UUID as PyUUID

    try:
        propuesta_id_str = str(PyUUID(propuesta_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")

    propuesta_db = db.query(Propuesta).filter(Propuesta.id == propuesta_id_str).first()
    if not propuesta_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")

    if propuesta_db.importador_id != current_user.get("importador_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre esta propuesta")

    if propuesta_db.estado != EstadoPropuesta.borrador.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se puede enviar una propuesta en estado borrador")

    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == propuesta_db.cotizacion_id).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    _validar_asignada(cotizacion, propuesta_db.importador_id, db)
    _validar_congruencia_categoria(cotizacion, propuesta_db.importador_id, db)

    propuesta_db.estado = EstadoPropuesta.pendiente
    # La fecha que cuenta es la del envío al cliente, no la del borrador.
    propuesta_db.fecha_envio = datetime.utcnow()
    if cotizacion.estado in ("abierta", "dirigida", EstadoCotizacion.abierta.value, EstadoCotizacion.dirigida.value):
        cotizacion.estado = EstadoCotizacion.propuestas_recibidas

    from services.eventos import TiposEvento, evento_propuesta

    evento_propuesta(
        db, TiposEvento.PROPUESTA_ENVIADA, propuesta_db, cotizacion, usuario=current_user,
        estado_anterior=EstadoPropuesta.borrador.value, estado_nuevo=EstadoPropuesta.pendiente.value,
        datos={"desde_borrador": True},
    )

    _notificar_propuesta_enviada(db, cotizacion=cotizacion, importador_id=propuesta_db.importador_id)

    db.commit()
    db.refresh(propuesta_db)

    if config.redis_client and cotizacion.modalidad == "abierta":
        try:
            config.redis_client.hset(f"cotizacion_abierta:{cotizacion.id}", propuesta_db.importador_id, "respondido")
            config.redis_client.incr(f"cotizacion_abierta:{cotizacion.id}:respuestas")
        except Exception:
            logger.warning("No se pudo actualizar el estado de matching en Redis para %s", cotizacion.id)

    return propuesta_db

def _resumen_empresas(db: Session, importador_ids: List[str]) -> dict:
    """Nombre y cumplimiento de cada empresa, para el comparador del comprador."""
    from models.orden import Orden
    from models.resena import ResenaImportador

    ids = list({str(i) for i in importador_ids if i})
    if not ids:
        return {}
    resenas = dict(db.query(ResenaImportador.importador_id, func.count(ResenaImportador.id)).filter(
        ResenaImportador.importador_id.in_(ids)
    ).group_by(ResenaImportador.importador_id).all())
    entregados = dict(db.query(Orden.importador_id, func.count(Orden.id)).filter(
        Orden.importador_id.in_(ids), Orden.estado == "entregado"
    ).group_by(Orden.importador_id).all())
    en_curso = dict(db.query(Orden.importador_id, func.count(Orden.id)).filter(
        Orden.importador_id.in_(ids), Orden.estado != "entregado"
    ).group_by(Orden.importador_id).all())
    return {
        str(e.id): {
            "importador_id": str(e.id),
            "nombre_empresa": e.nombre_empresa,
            "logo_url": e.logo_url,
            "verificado": bool(e.verificado),
            "calificacion_promedio": float(e.calificacion_promedio or 0),
            "total_resenas": int(resenas.get(str(e.id), 0)),
            "pedidos_entregados": int(entregados.get(str(e.id), 0)),
            "pedidos_en_curso": int(en_curso.get(str(e.id), 0)),
        }
        for e in db.query(Importador).filter(Importador.id.in_(ids)).all()
    }


@router.get("/{cotizacion_id}/propuestas", response_model=List[PropuestaResponse])
async def listar_propuestas(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Listar las propuestas de una cotización.

    - **solicitante** dueño de la cotización: ve todas las propuestas enviadas
      por las empresas (los borradores en redacción siguen ocultos).
    - **empresa** (dueño o asesor): ve **solo las propuestas de su propia
      empresa**, incluidos sus borradores. Antes recibía un 403 aquí y no tenía
      forma de consultar por API lo que ella misma había enviado.

    - **cotizacion_id**: ID de la cotización (UUID)
    """
    from uuid import UUID as PyUUID

    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    rol = current_user["rol"]

    if rol not in ("solicitante", "importador", "asesor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para ver las propuestas de esta cotización"
        )

    try:
        cotizacion_id_str = str(PyUUID(cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )

    consulta = db.query(Propuesta).filter(Propuesta.cotizacion_id == cotizacion_id_str)

    if rol == "solicitante":
        # Verificar que el solicitante es el dueño de la cotización
        cotizacion = db.query(Cotizacion).filter(
            Cotizacion.id == cotizacion_id_str,
            Cotizacion.solicitante_id == user_id_str
        ).first()
        if not cotizacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cotización no encontrada"
            )
        # Los borradores en redacción del asesor no se muestran hasta que la
        # empresa los envía.
        consulta = consulta.filter(Propuesta.estado != EstadoPropuesta.borrador.value)
    else:
        importador_id_str = current_user.get("importador_id")
        if not importador_id_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cuenta no está asociada a ninguna empresa importadora"
            )
        cotizacion = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id_str).first()
        if not cotizacion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cotización no encontrada"
            )
        # Nunca se exponen las propuestas de la competencia en una cotización abierta.
        consulta = consulta.filter(Propuesta.importador_id == importador_id_str)

    # Orden de llegada, nunca por precio: el comparador muestra precio, plazo,
    # lo que incluye y el cumplimiento al mismo nivel.
    propuestas = consulta.order_by(Propuesta.fecha_envio.asc()).all()
    empresas = _resumen_empresas(db, [p.importador_id for p in propuestas]) if rol == "solicitante" else {}

    return [
        PropuestaResponse(
            id=str(p.id),
            cotizacion_id=p.cotizacion_id,
            importador_id=p.importador_id,
            precio_ofrecido_usd=p.precio_ofrecido_usd,
            tiempo_estimado_entrega=p.tiempo_estimado_entrega,
            incoterm=p.incoterm,
            condiciones_adicionales=p.condiciones_adicionales,
            estado=p.estado.value if isinstance(p.estado, EstadoPropuesta) else p.estado,
            creado_por_usuario_id=p.creado_por_usuario_id,
            preaceptada_por_solicitante=p.preaceptada_por_solicitante,
            preaceptada_por_empresa=p.preaceptada_por_empresa,
            cantidad=p.cantidad,
            fecha_envio=p.fecha_envio,
            revisiones=p.revisiones or 0,
            fecha_modificacion=p.fecha_modificacion,
            motivo_descarte=p.motivo_descarte,
            motivo_descarte_detalle=p.motivo_descarte_detalle,
            empresa=empresas.get(p.importador_id),
            contacto_asesor=p.contacto_asesor
        )
        for p in propuestas
    ]

@router.get("/{cotizacion_id}/matching-status", response_model=MatchingStatusResponse)
async def obtener_estado_matching(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """
    Obtiene el estado de difusión de una cotización abierta a la red de importadores:
    cuántos importadores la recibieron, cuántos ya respondieron con una propuesta y
    cuáles siguen pendientes. Corresponde al wireframe "Panel de Propuestas Recibidas"
    (Pantalla 6), que muestra el contador "X de Y importadores respondieron" y la
    sección "Pendientes de Responder".

    Solo el solicitante dueño de la cotización puede consultar este estado, y solo
    aplica a cotizaciones en modalidad "abierta".
    """
    from uuid import UUID as PyUUID
    from services.matching_service import obtener_estado_matching_detallado

    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite

    try:
        cotizacion_id_str = str(PyUUID(cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )

    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.solicitante_id == user_id_str
    ).first()

    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada"
        )

    if cotizacion.modalidad != "abierta":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estado de matching solo aplica a cotizaciones en modalidad abierta"
        )

    estado_matching = obtener_estado_matching_detallado(cotizacion_id_str)

    importadores_pendientes = []
    if estado_matching["ids_pendientes"]:
        importadores = db.query(Importador).filter(
            Importador.id.in_(estado_matching["ids_pendientes"])
        ).all()
        importadores_pendientes = [
            ImportadorPendienteResponse(
                importador_id=str(importador.id),
                nombre_empresa=importador.nombre_empresa,
                logo_url=importador.logo_url
            )
            for importador in importadores
        ]

    return MatchingStatusResponse(
        total_matching=estado_matching["total_matching"],
        respondidos=estado_matching["respondidos"],
        pendientes=estado_matching["pendientes"],
        importadores_pendientes=importadores_pendientes
    )

@router.put("/{cotizacion_id}/propuestas/aceptar", response_model=CotizacionResponse)
async def aceptar_propuesta(
    cotizacion_id: str,
    solicitud: PropuestaAceptadaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """
    Abre la negociación con la empresa de una propuesta: crea (o reutiliza) el
    chat con el asesor asignado (o el dueño, si nadie la reclamó) para que
    ambas partes negocien antes de la aceptación definitiva.

    **Este endpoint NO acepta la propuesta de forma definitiva.** Desde la
    Semana 4, una propuesta solo queda aceptada mediante doble aceptación
    mutua: ver `POST /propuestas/{propuesta_id}/pre-aceptar`. Este paso previo
    solo habilita el canal de chat para negociar condiciones antes de que
    ambas partes confirmen.

    - **cotizacion_id**: ID de la cotización (UUID)
    - **importador_id**: ID del importador cuya propuesta se quiere negociar
    """
    from uuid import UUID as PyUUID
    
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    try:
        cotizacion_id_str = str(PyUUID(cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    # Verificar que el solicitante es el dueño de la cotización
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.solicitante_id == user_id_str
    ).first()
    
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada"
        )
    
    # Verificar que la cotización está en estado "propuestas_recibidas"
    if cotizacion.estado != EstadoCotizacion.propuestas_recibidas.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cotización no tiene propuestas pendientes para negociar"
        )
    
    # Verificar que la propuesta existe y es del importador indicado
    try:
        importador_id_str = str(PyUUID(solicitud.importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de importador inválido"
        )
    
    propuesta = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.importador_id == importador_id_str,
        Propuesta.estado == EstadoPropuesta.pendiente.value
    ).first()
    
    if not propuesta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propuesta no encontrada o ya fue aceptada/rechazada"
        )

    # Notificación persistente + Redis (best-effort) al asesor asignado.
    if cotizacion.asesor_asignado_id:
        from services.notificacion_service import crear_notificacion_best_effort
        from services.pdf_document_service import generate_order_documents
        crear_notificacion_best_effort(
            db,
            usuario_id=cotizacion.asesor_asignado_id,
            tipo="negociacion",
            titulo="El solicitante quiere negociar",
            mensaje="Se abrió el canal de chat de una cotización que reclamaste.",
            data={
                "tipo": "negociacion_iniciada",
                "cotizacion_id": cotizacion_id_str,
                "importador_id": importador_id_str,
            },
        )
    if config.redis_client and cotizacion.asesor_asignado_id:
        try:
            config.redis_client.publish(
                f"asesor:{cotizacion.asesor_asignado_id}:notificaciones",
                str({
                    "tipo": "negociacion_iniciada",
                    "cotizacion_id": cotizacion_id_str,
                    "importador_id": importador_id_str
                })
            )
        except Exception:
            logger.warning("No se pudo notificar al asesor asignado de la cotización %s", cotizacion_id_str)

    # El hilo normalmente ya existe (se abre al reclamar la cotización). Esto
    # cubre el caso de la propuesta enviada directamente por la cuenta dueña,
    # donde nadie pasó por el reclamo.
    from models.usuario import Usuario as UsuarioModel

    importador_usuario_id = cotizacion.asesor_asignado_id
    if not importador_usuario_id:
        dueño = db.query(UsuarioModel).filter(
            UsuarioModel.importador_id == importador_id_str,
            UsuarioModel.rol == "importador"
        ).first()
        importador_usuario_id = str(dueño.id) if dueño else None

    if importador_usuario_id:
        _asegurar_chat_negociacion(
            db,
            cotizacion=cotizacion,
            importador_usuario_id=importador_usuario_id,
        )

    from services.eventos import Evento, TiposEvento, evento_propuesta

    # Una vez por propuesta: el cliente puede volver a pulsar "Negociar".
    ya_en_negociacion = db.query(Evento.id).filter(
        Evento.tipo == TiposEvento.PROPUESTA_EN_NEGOCIACION,
        Evento.propuesta_id == str(propuesta.id),
    ).first()
    if not ya_en_negociacion:
        evento_propuesta(db, TiposEvento.PROPUESTA_EN_NEGOCIACION, propuesta, cotizacion, usuario=current_user)
    db.commit()

    db.refresh(cotizacion)
    return cotizacion


@router.post("/{cotizacion_id}/desbloquear", response_model=CotizacionResponse)
async def desbloquear_cotizacion_por_punto(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante")),
):
    """Consume un punto para habilitar una cotización que supera el tier del cotizante."""
    try:
        cotizacion_id_str = str(UUID(cotizacion_id))
        user_id_str = str(UUID(current_user["user_id"]))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID inválido")

    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.solicitante_id == user_id_str,
    ).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")
    if not cotizacion.bloqueada:
        return cotizacion

    from services.tier_service import SinPuntosParaDesbloquear, consumir_punto_desbloqueo

    try:
        consumir_punto_desbloqueo(db, usuario_id=user_id_str, cotizacion_id=cotizacion_id_str)
    except SinPuntosParaDesbloquear:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MENSAJE_SIN_PUNTOS)

    db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id_str).update(
        {Cotizacion.desbloqueada_por_puntos: True},
        synchronize_session=False,
    )
    db.commit()
    db.refresh(cotizacion)
    return cotizacion


@propuestas_router.post("/{propuesta_id}/pre-aceptar", response_model=PropuestaResponse)
async def pre_aceptar_propuesta(
    propuesta_id: str,
    solicitud: PreaceptarPropuestaRequest,
    current_user: dict = Depends(require_rol_in("solicitante", "importador", "asesor")),
    db: Session = Depends(get_db)
):
    """
    Marca (o revierte) la pre-aceptación de tu lado sobre una propuesta enviada
    (doble aceptación mutua, Semana 4).

    - El **solicitante** dueño de la cotización marca/revierte el lado "solicitante".
    - Solo la cuenta **dueña** (rol `importador`) marca/revierte el lado
      "empresa": el asesor negocia, pero quien compromete a la empresa es su
      representante, que revisa el chat de la negociación antes de confirmar.

    Cuando ambos lados quedan en `True` (sin importar el orden), la propuesta
    se finaliza automáticamente en la misma transacción:
    - Pasa a `estado="aceptada"`; las demás propuestas de la cotización se rechazan.
    - La cotización pasa a `estado="orden_activa"` y se fija `importador_id` a la
      empresa ganadora (también en modalidad abierta, donde antes quedaba NULL).
    - Se crea la **Orden automáticamente** (sin pago de por medio: la plataforma
      solo conecta, no se responsabiliza del cumplimiento entre las partes).
    - El chat **sigue con el asesor** que negoció, pero cambia de asunto: pasa a
      ser el seguimiento del embarque. La empresa lo coordina con él por el
      canal interno (`POST /chat/interno`).

    Mientras el otro lado no haya aceptado, cualquiera de las dos partes puede
    revertir su propia marca (`aceptar: false`). Una vez finalizada (ambos lados
    en `True`), la propuesta queda bloqueada y este endpoint ya no admite cambios.
    """
    from uuid import UUID as PyUUID, uuid4 as gen_uuid
    from models.orden import Orden, HistorialEstadosOrden, EstadoOrden
    from models.chat import ConversacionChat, MensajeChat, TipoMensajeChat
    from models.usuario import Usuario as UsuarioModel

    user_id_str = str(PyUUID(current_user["user_id"]))

    try:
        propuesta_id_str = str(PyUUID(propuesta_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")

    propuesta = db.query(Propuesta).filter(Propuesta.id == propuesta_id_str).first()
    if not propuesta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propuesta no encontrada")

    if propuesta.estado != EstadoPropuesta.pendiente.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se puede pre-aceptar una propuesta enviada (pendiente); si ya fue aceptada, quedó bloqueada"
        )

    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == propuesta.cotizacion_id).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    rol = current_user["rol"]
    lado = None

    if rol == "solicitante" and cotizacion.solicitante_id == user_id_str:
        lado = "solicitante"
    elif rol == "importador" and current_user.get("importador_id") == propuesta.importador_id:
        # La confirmación de la empresa la da la cuenta dueña, no el asesor: es
        # el paso en el que la empresa revisa la negociación de su asesor (el
        # chat queda como evidencia) antes de comprometerse con la orden.
        lado = "empresa"
    elif rol == "asesor" and current_user.get("importador_id") == propuesta.importador_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "La aceptación final la confirma la cuenta dueña de la empresa. "
                "Tu negociación queda registrada en el chat y es lo que revisará "
                "antes de cerrar la orden."
            )
        )

    if lado is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para pre-aceptar esta propuesta"
        )

    if lado == "empresa" and (solicitud.motivo_eleccion or solicitud.motivo_detalle):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El motivo de la elección solo lo indica el solicitante"
        )

    from services.eventos import TiposEvento, evento_propuesta

    if lado == "solicitante":
        propuesta.preaceptada_por_solicitante = solicitud.aceptar
        # Por qué eligió esta propuesta: se convierte en el motivo de descarte
        # de las demás cuando la orden se cierre. Si retira la aceptación, el
        # motivo deja de valer.
        if solicitud.aceptar:
            if solicitud.motivo_eleccion:
                cotizacion.motivo_eleccion = solicitud.motivo_eleccion
                cotizacion.motivo_eleccion_detalle = (solicitud.motivo_detalle or "").strip() or None
        else:
            cotizacion.motivo_eleccion = None
            cotizacion.motivo_eleccion_detalle = None
        # La empresa se entera de que el cliente movió ficha, aunque todavía
        # falte su propia confirmación.
        # Aquí la pelota pasa a la cuenta dueña, que es la única que puede
        # confirmar: el aviso va a toda la empresa (dueño incluido) en vez de
        # solo al asesor, que ya no tiene nada que firmar.
        _notificar_empresa(
            db,
            importador_id=propuesta.importador_id,
            tipo="propuesta",
            titulo="El solicitante aceptó la propuesta" if solicitud.aceptar else "El solicitante retiró su aceptación",
            mensaje=(
                f"Cotización de {cotizacion.nombre_producto}. "
                + (
                    "Revisa el chat de la negociación y confírmala desde la cuenta de la empresa para cerrar la orden."
                    if solicitud.aceptar
                    else "La negociación sigue abierta."
                )
            ),
            data={"cotizacion_id": str(cotizacion.id), "propuesta_id": str(propuesta.id)},
            enlace_relativo="/cotizaciones",
        )
    else:
        propuesta.preaceptada_por_empresa = solicitud.aceptar
        from services.notificacion_service import notificar as _notificar_usuario

        _notificar_usuario(
            db,
            usuario_id=cotizacion.solicitante_id,
            tipo="propuesta",
            titulo="La empresa confirmó la propuesta" if solicitud.aceptar else "La empresa retiró su confirmación",
            mensaje=f"Cotización de {cotizacion.nombre_producto}.",
            data={"cotizacion_id": str(cotizacion.id), "propuesta_id": str(propuesta.id)},
            enlace_relativo="/cotizaciones",
        )

    evento_propuesta(
        db, TiposEvento.PROPUESTA_PREACEPTADA, propuesta, cotizacion, usuario=current_user,
        datos={"lado": lado, "aceptar": solicitud.aceptar},
        motivo=solicitud.motivo_eleccion if lado == "solicitante" and solicitud.aceptar else None,
        motivo_detalle=(solicitud.motivo_detalle or None) if lado == "solicitante" and solicitud.aceptar else None,
    )

    if propuesta.preaceptada_por_solicitante and propuesta.preaceptada_por_empresa:
        # --- Finalización: doble aceptación mutua confirmada ---
        propuesta.estado = EstadoPropuesta.aceptada

        otras = db.query(Propuesta).filter(
            Propuesta.cotizacion_id == cotizacion.id,
            Propuesta.id != propuesta.id,
            Propuesta.estado.in_([EstadoPropuesta.pendiente.value, EstadoPropuesta.borrador.value])
        ).all()
        ahora = datetime.utcnow()
        for p in otras:
            estado_previo = p.estado.value if isinstance(p.estado, EstadoPropuesta) else p.estado
            p.estado = EstadoPropuesta.rechazada
            # Un borrador nunca llegó al cliente: no "perdió", solo se cierra.
            if estado_previo != EstadoPropuesta.pendiente.value:
                continue
            p.motivo_descarte = cotizacion.motivo_eleccion
            p.motivo_descarte_detalle = cotizacion.motivo_eleccion_detalle
            p.fecha_descarte = ahora
            evento_propuesta(
                db, TiposEvento.PROPUESTA_DESCARTADA, p, cotizacion, usuario=current_user,
                estado_anterior=estado_previo, estado_nuevo=EstadoPropuesta.rechazada.value,
                motivo=cotizacion.motivo_eleccion or "sin_motivo",
                motivo_detalle=cotizacion.motivo_eleccion_detalle,
                datos={"propuesta_ganadora_id": str(propuesta.id)},
            )

        # Orden creada en la misma transacción → estado operativo de la cotización.
        cotizacion.estado = EstadoCotizacion.orden_activa
        # En abiertas el importador_id era NULL; fijarlo a la empresa ganadora.
        cotizacion.importador_id = propuesta.importador_id

        nueva_orden = db.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        if not nueva_orden:
            # La marca de embarque se congela aquí: hasta este momento, en una
            # cotización abierta ni siquiera se sabía qué empresa pondría el
            # prefijo. A partir de ahora es un dato del embarque, no del perfil.
            from utils.shipping_mark import componer_shipping_mark

            empresa_ganadora = db.query(Importador).filter(
                Importador.id == propuesta.importador_id
            ).first()
            marca = componer_shipping_mark(
                empresa_ganadora.shipping_mark_prefijo if empresa_ganadora else None,
                cotizacion.shipping_mark_sufijo,
            )

            nueva_orden = Orden(
                id=str(gen_uuid()),
                cotizacion_id=cotizacion.id,
                importador_id=propuesta.importador_id,
                solicitante_id=cotizacion.solicitante_id,
                asesor_asignado_id=cotizacion.asesor_asignado_id,
                estado=EstadoOrden.cotizacion_aceptada,
                precio_acordado_usd=propuesta.precio_ofrecido_usd,
                tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
                condiciones_adicionales=propuesta.condiciones_adicionales,
                shipping_mark=marca
            )
            db.add(nueva_orden)
            db.flush()
            db.add(HistorialEstadosOrden(
                orden_id=nueva_orden.id,
                estado_anterior=None,
                estado_nuevo=EstadoOrden.cotizacion_aceptada.value
            ))
            from services.eventos import evento_pedido

            evento_pedido(
                db, nueva_orden, estado_anterior=None, estado_nuevo=EstadoOrden.cotizacion_aceptada.value,
                usuario=current_user, cotizacion=cotizacion,
            )

        evento_propuesta(
            db, TiposEvento.PROPUESTA_ACEPTADA, propuesta, cotizacion, usuario=current_user,
            estado_anterior=EstadoPropuesta.pendiente.value, estado_nuevo=EstadoPropuesta.aceptada.value,
            orden_id=nueva_orden.id,
            motivo=cotizacion.motivo_eleccion,
            motivo_detalle=cotizacion.motivo_eleccion_detalle,
        )

        try:
            generate_order_documents(
                db,
                orden=nueva_orden,
                cotizacion=cotizacion,
                propuesta=propuesta,
            )
        except Exception:
            logger.warning("No se pudieron generar documentos PDF automáticos para la orden %s", nueva_orden.id)

        # El mismo hilo cambia de asunto: deja de ser la negociación de la
        # cotización y pasa a ser el seguimiento del embarque. Lo sigue
        # atendiendo el asesor que negoció —es quien conoce el trato— y no el
        # dueño, que solo entra a confirmar y a supervisar.
        dueño = db.query(UsuarioModel).filter(
            UsuarioModel.importador_id == propuesta.importador_id,
            UsuarioModel.rol == "importador"
        ).first()
        dueño_id = str(dueño.id) if dueño else None
        responsable_id = cotizacion.asesor_asignado_id or dueño_id

        conversacion = db.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).first()

        if not conversacion and responsable_id:
            conversacion = ConversacionChat(
                id=str(gen_uuid()),
                cotizacion_id=cotizacion.id,
                solicitante_id=cotizacion.solicitante_id,
                importador_usuario_id=responsable_id
            )
            db.add(conversacion)
            db.flush()
        elif conversacion and responsable_id:
            conversacion.importador_usuario_id = responsable_id

        if conversacion:
            conversacion.orden_id = nueva_orden.id
            db.add(MensajeChat(
                id=str(gen_uuid()),
                conversacion_id=conversacion.id,
                remitente_id=responsable_id or user_id_str,
                contenido=(
                    "La empresa confirmó la propuesta y se creó la orden. "
                    "Esta conversación pasa a ser el seguimiento del embarque: "
                    "aquí se irán informando los cambios de estado."
                ),
                tipo=TipoMensajeChat.sistema
            ))

        if config.redis_client:
            try:
                config.redis_client.publish(
                    f"cotizacion:{cotizacion.id}:notificaciones",
                    str({"tipo": "propuesta_aceptada_doble", "cotizacion_id": cotizacion.id, "orden_id": nueva_orden.id})
                )
            except Exception:
                logger.warning("No se pudo publicar notificación de doble aceptación para %s", cotizacion.id)

        # Una orden nueva suma al desempeño del cotizante (órdenes y valor USD).
        from services.tier_service import recalcular_tier_best_effort

        recalcular_tier_best_effort(db, cotizacion.solicitante_id)

    db.commit()
    db.refresh(propuesta)

    return propuesta

# ==================== Recreación de cotización por error (Fase 3 - créditos) ====================

@router.post(
    "/{cotizacion_id}/solicitar-recreacion",
    response_model=SolicitudRecreacionResponse,
    status_code=status.HTTP_201_CREATED
)
async def solicitar_recreacion(
    cotizacion_id: str,
    solicitud: SolicitarRecreacionRequest,
    current_user: dict = Depends(require_rol_in("solicitante", "importador", "asesor")),
    db: Session = Depends(get_db)
):
    """
    Solicita anular y recrear una cotización que tuvo un error durante la
    negociación (una vez aceptada, la cotización es "one-time": para corregirla
    hay que crear una completamente nueva). Un admin decide qué parte fue
    responsable en `PUT /admin/recreaciones/{id}/resolver`; si es la empresa
    importadora, se exime al solicitante del costo de la cotización de reemplazo.
    """
    try:
        cotizacion_id_str = str(UUID(cotizacion_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    cotizacion = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id_str).first()
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada")

    user_id_str = str(UUID(current_user["user_id"]))
    rol = current_user["rol"]
    empresa_id = current_user.get("importador_id")

    # IDOR: solicitante dueño, o miembro de la empresa ganadora.
    # En abiertas históricas `cotizacion.importador_id` podía ser NULL: se valida
    # también contra la propuesta aceptada.
    es_solicitante_dueño = rol == "solicitante" and cotizacion.solicitante_id == user_id_str
    es_empresa_involucrada = False
    if rol in ("importador", "asesor") and empresa_id:
        if cotizacion.importador_id == empresa_id:
            es_empresa_involucrada = True
        else:
            propuesta_ganadora = db.query(Propuesta).filter(
                Propuesta.cotizacion_id == cotizacion_id_str,
                Propuesta.importador_id == empresa_id,
                Propuesta.estado == EstadoPropuesta.aceptada.value
            ).first()
            es_empresa_involucrada = propuesta_ganadora is not None
    if not (es_solicitante_dueño or es_empresa_involucrada):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado sobre esta cotización")

    if cotizacion.estado not in (EstadoCotizacion.cotizacion_aceptada.value, EstadoCotizacion.orden_activa.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se puede solicitar la recreación de una cotización ya aceptada"
        )

    from uuid import uuid4 as gen_uuid
    from models.solicitud_recreacion import SolicitudRecreacion

    nueva_solicitud = SolicitudRecreacion(
        id=str(gen_uuid()),
        cotizacion_origen_id=cotizacion_id_str,
        solicitado_por_usuario_id=user_id_str,
        motivo=solicitud.motivo,
        parte_atribuida_sugerida=solicitud.parte_atribuida_sugerida
    )
    db.add(nueva_solicitud)
    db.commit()
    db.refresh(nueva_solicitud)

    return nueva_solicitud
