import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
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
from models.propuesta import Propuesta, EstadoPropuesta
from models.importador import Importador
from utils.dependencies import get_db, get_current_user, require_rol, require_rol_in

logger = logging.getLogger("importacionesq8")

# Importar motor de matching (después de los routers para evitar circular imports)
matching_cotizacion_abierta = None

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite"""
    return column.like(f'%"{value}"%')

router = APIRouter(prefix="/cotizaciones", tags=["Cotizaciones"])

# Router independiente para /propuestas (no anidado bajo /cotizaciones) - ver Tarea 2.1
propuestas_router = APIRouter(prefix="/propuestas", tags=["Propuestas"])

@router.get("/", response_model=List[CotizacionResponse])
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
    Pool de cotizaciones de la empresa (dirigidas a ella, o abiertas donde aparece
    en el matching) que todavía nadie ha reclamado. La cuenta dueña (representante
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

    # Índice Redis por importador (SET) — sin KEYS O(N).
    from services.matching_service import listar_cotizaciones_matching_importador
    matching_ids = listar_cotizaciones_matching_importador(importador_id_str)

    resultado = [
        c for c in cotizaciones_candidatas
        if c.importador_id == importador_id_str or str(c.id) in matching_ids
    ]

    return resultado

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

    db.commit()
    db.refresh(cotizacion)

    return cotizacion

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
    
    # Importador/asesor solo puede ver si es dirigida a su empresa o es abierta
    if rol in ("importador", "asesor") and cotizacion.importador_id != current_user.get("importador_id") and cotizacion.modalidad != "abierta":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta cotización"
        )
    
    return cotizacion

@router.post("/", response_model=CotizacionResponse, status_code=status.HTTP_201_CREATED)
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
    from sqlalchemy import update
    from models.usuario import Usuario
    from models.credito import MovimientoCredito, TipoMovimientoCredito

    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite

    # Créditos (Semana 4): crear una cotización tiene costo, distinto según la
    # modalidad. La plataforma no cobra comisión sobre la orden; solo cobra por
    # conectar (crear la solicitud), sin responsabilizarse del negocio posterior.
    solicitante = db.query(Usuario).filter(Usuario.id == user_id_str).first()
    if not solicitante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    costo_creditos = (
        config.CREDITO_COSTO_COTIZACION_ABIERTA if cotizacion_data.modalidad == "abierta"
        else config.CREDITO_COSTO_COTIZACION_DIRIGIDA
    )
    saldo_actual = solicitante.creditos_balance or 0
    if saldo_actual < costo_creditos:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Créditos insuficientes: se necesitan {costo_creditos} créditos para crear esta "
                f"cotización (saldo actual: {saldo_actual}). Compra créditos en "
                f"POST /creditos/comprar"
            )
        )

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
    
    # Crear nueva cotización - usar el importador_id como string directamente
    nuevo_cotizacion = Cotizacion(
        id=str(uuid4()),  # Convertir a string para SQLite
        solicitante_id=user_id_str,
        importador_id=cotizacion_data.importador_id if cotizacion_data.importador_id else None,
        campos_personalizados_valores=cotizacion_data.campos_personalizados_valores,
        modalidad=cotizacion_data.modalidad,
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
        precio_objetivo_usd=cotizacion_data.precio_objetivo_usd,
        incoterm=cotizacion_data.incoterm,
        notas_adicionales=cotizacion_data.notas_adicionales,
        costo_creditos=costo_creditos,
        estado="dirigida" if cotizacion_data.modalidad == "dirigida" else "abierta"
    )
    
    db.add(nuevo_cotizacion)

    # Débito atómico: UPDATE ... WHERE balance >= costo evita saldos negativos
    # bajo peticiones concurrentes (read-check-write clásico).
    debito = db.execute(
        update(Usuario)
        .where(
            Usuario.id == user_id_str,
            Usuario.creditos_balance >= costo_creditos,
        )
        .values(creditos_balance=Usuario.creditos_balance - costo_creditos)
    )
    if debito.rowcount != 1:
        db.rollback()
        solicitante = db.query(Usuario).filter(Usuario.id == user_id_str).first()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Créditos insuficientes: se necesitan {costo_creditos} créditos para crear esta "
                f"cotización (saldo actual: {(solicitante.creditos_balance if solicitante else 0) or 0}). "
                f"Compra créditos en POST /creditos/comprar"
            ),
        )

    db.add(MovimientoCredito(
        id=str(uuid4()),
        usuario_id=user_id_str,
        tipo=TipoMovimientoCredito.consumo.value,
        monto=-costo_creditos,
        cotizacion_id=nuevo_cotizacion.id,
        descripcion=f"Creación de cotización {cotizacion_data.modalidad}"
    ))

    db.commit()
    db.refresh(nuevo_cotizacion)
    db.refresh(solicitante)
    
    # Si es cotización abierta, ejecutar el motor de matching (después del commit para tener ID)
    if cotizacion_data.modalidad == "abierta":
        from services.matching_service import matching_cotizacion_abierta as mc
        mc(
            str(nuevo_cotizacion.id),
            nuevo_cotizacion.pais_importacion,
            nuevo_cotizacion.linea_producto,
            db
        )
    
    return nuevo_cotizacion

# ==================== Endpoints de Propuestas (Tarea 2.1) ====================

def _validar_congruencia_categoria(cotizacion: Cotizacion, importador_id_str: str, db: Session):
    """
    Una empresa importadora solo puede responder cotizaciones de su propia
    especialidad (ej. una empresa de tecnología no puede responder una
    cotización de alimentos y viceversa). Se aplica tanto a propuestas
    dirigidas como a propuestas sobre cotizaciones abiertas.
    """
    importador_empresa = db.query(Importador).filter(Importador.id == importador_id_str).first()
    especialidades = (importador_empresa.especialidad_producto or []) if importador_empresa else []
    if cotizacion.linea_producto not in especialidades:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"La categoría de la cotización ('{cotizacion.linea_producto}') no es congruente con la "
                f"especialidad de tu empresa. Solo puedes responder cotizaciones de tu(s) especialidad(es)."
            )
        )


@propuestas_router.post("/", response_model=PropuestaResponse, status_code=status.HTTP_201_CREATED)
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
    2. Si es abierta: el importador debe estar en la lista de matching para esta cotización
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
    # 2. Verificar matching Redis en cotizaciones abiertas (fail-closed).
    elif cotizacion.modalidad == "abierta":
        if not config.redis_client:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de matching temporalmente no disponible, intenta de nuevo"
            )
        try:
            importadores_matching = config.redis_client.hgetall(f"cotizacion_abierta:{cotizacion_id_str}")
        except Exception:
            logger.warning("Redis no disponible al verificar matching de cotización %s", cotizacion_id_str)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de matching temporalmente no disponible, intenta de nuevo"
            )
        if importador_id_str not in importadores_matching:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado para responder esta cotización (no está en la lista de matching)"
            )

    # 2.5. Congruencia de categoría: la especialidad de la empresa debe incluir la línea de producto solicitada
    _validar_congruencia_categoria(cotizacion, importador_id_str, db)

    # 3. Verificar que el importador no ha enviado ya una propuesta a esta cotización
    propuesta_existente = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.importador_id == importador_id_str
    ).first()
    
    if propuesta_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya has enviado una propuesta a esta cotización"
        )
    
    # 4. Crear nueva propuesta en la base de datos
    nueva_propuesta = Propuesta(
        id=str(uuid4()),  # Convertir a string para SQLite
        cotizacion_id=cotizacion_id_str,
        importador_id=importador_id_str,
        precio_ofrecido_usd=propuesta.precio_ofrecido_usd,
        tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
        incoterm=propuesta.incoterm,
        condiciones_adicionales=propuesta.condiciones_adicionales,
        estado=EstadoPropuesta.pendiente,
        creado_por_usuario_id=user_id_str
    )
    db.add(nueva_propuesta)
    
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
        contacto_asesor=nueva_propuesta.contacto_asesor
    )

# ==================== Borrador (asesor) / envío (dueño) de propuestas (Fase 4) ====================

@propuestas_router.post("/borrador", response_model=PropuestaResponse, status_code=status.HTTP_201_CREATED)
async def crear_borrador_propuesta(
    propuesta: PropuestaCreate,
    current_user: dict = Depends(require_rol("asesor")),
    db: Session = Depends(get_db)
):
    """
    Un asesor redacta un borrador de propuesta para una cotización que reclamó
    (`POST /cotizaciones/{id}/reclamar`). El borrador no es visible para el
    solicitante hasta que la cuenta dueña lo envíe (`POST /propuestas/{id}/enviar`).
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

    # Solo el asesor que reclamó la cotización puede redactar su borrador
    if cotizacion.asesor_asignado_id != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes redactar propuestas de cotizaciones que hayas reclamado"
        )

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
    propuesta_db.creado_por_usuario_id = str(PyUUID(current_user["user_id"]))
    # Una edición reinicia la pre-aceptación mutua: cualquier cambio debe volver a confirmarse
    propuesta_db.preaceptada_por_solicitante = False
    propuesta_db.preaceptada_por_empresa = False

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

    _validar_congruencia_categoria(cotizacion, propuesta_db.importador_id, db)

    propuesta_db.estado = EstadoPropuesta.pendiente
    if cotizacion.estado in ("abierta", "dirigida", EstadoCotizacion.abierta.value, EstadoCotizacion.dirigida.value):
        cotizacion.estado = EstadoCotizacion.propuestas_recibidas

    db.commit()
    db.refresh(propuesta_db)

    if config.redis_client and cotizacion.modalidad == "abierta":
        try:
            config.redis_client.hset(f"cotizacion_abierta:{cotizacion.id}", propuesta_db.importador_id, "respondido")
            config.redis_client.incr(f"cotizacion_abierta:{cotizacion.id}:respuestas")
        except Exception:
            logger.warning("No se pudo actualizar el estado de matching en Redis para %s", cotizacion.id)

    return propuesta_db

@router.get("/{cotizacion_id}/propuestas", response_model=List[PropuestaResponse])
async def listar_propuestas(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Listar todas las propuestas recibidas para una cotización. Solo el solicitante de la cotización puede verlas.
    
    - **cotizacion_id**: ID de la cotización (UUID)
    """
    from uuid import UUID as PyUUID
    
    # Verificar que el usuario es el solicitante de esta cotización
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    if current_user["rol"] != "solicitante":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo el solicitante puede ver las propuestas"
        )
    
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
    
    # Listar las propuestas visibles para el solicitante (los borradores en
    # redacción del asesor todavía no se muestran hasta que la empresa las envía)
    propuestas = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.estado != EstadoPropuesta.borrador.value
    ).order_by(Propuesta.fecha_envio.desc()).all()
    
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

    # Notificar (best-effort) al asesor que reclamó la cotización de que el
    # solicitante quiere negociar, para que empiece la conversación por chat. Si
    # nadie la reclamó, no hay a quién notificar por este canal (la cuenta dueña
    # ya lo sabe porque fue quien recibió la respuesta del solicitante).
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

    # Crear la conversación de chat de negociación: el asesor asignado negocia
    # con el solicitante si reclamó la cotización; si no, la cuenta dueña.
    from models.chat import ConversacionChat
    from models.usuario import Usuario as UsuarioModel
    conversacion_existente = db.query(ConversacionChat).filter(
        ConversacionChat.cotizacion_id == cotizacion_id_str
    ).first()
    if not conversacion_existente:
        importador_usuario_id = cotizacion.asesor_asignado_id
        if not importador_usuario_id:
            dueño = db.query(UsuarioModel).filter(
                UsuarioModel.importador_id == importador_id_str,
                UsuarioModel.rol == "importador"
            ).first()
            importador_usuario_id = str(dueño.id) if dueño else None

        if importador_usuario_id:
            from uuid import uuid4 as gen_uuid
            nueva_conversacion = ConversacionChat(
                id=str(gen_uuid()),
                cotizacion_id=cotizacion_id_str,
                solicitante_id=user_id_str,
                importador_usuario_id=importador_usuario_id
            )
            db.add(nueva_conversacion)
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
    - El **asesor asignado** a la cotización o el **dueño** (cuenta `importador`)
      de la empresa marcan/revierten el lado "empresa".

    Cuando ambos lados quedan en `True` (sin importar el orden), la propuesta
    se finaliza automáticamente en la misma transacción:
    - Pasa a `estado="aceptada"`; las demás propuestas de la cotización se rechazan.
    - La cotización pasa a `estado="orden_activa"` y se fija `importador_id` a la
      empresa ganadora (también en modalidad abierta, donde antes quedaba NULL).
    - Se crea la **Orden automáticamente** (sin pago de por medio: la plataforma
      solo conecta, no se responsabiliza del cumplimiento entre las partes).
    - El chat de negociación se **traspasa al dueño** de la empresa (supervisor /
      representante legal), quien queda a cargo de ahí en adelante.

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
    elif rol in ("importador", "asesor") and current_user.get("importador_id") == propuesta.importador_id:
        if rol == "importador" or cotizacion.asesor_asignado_id == user_id_str:
            lado = "empresa"

    if lado is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para pre-aceptar esta propuesta"
        )

    if lado == "solicitante":
        propuesta.preaceptada_por_solicitante = solicitud.aceptar
    else:
        propuesta.preaceptada_por_empresa = solicitud.aceptar

    if propuesta.preaceptada_por_solicitante and propuesta.preaceptada_por_empresa:
        # --- Finalización: doble aceptación mutua confirmada ---
        propuesta.estado = EstadoPropuesta.aceptada

        otras = db.query(Propuesta).filter(
            Propuesta.cotizacion_id == cotizacion.id,
            Propuesta.id != propuesta.id,
            Propuesta.estado.in_([EstadoPropuesta.pendiente.value, EstadoPropuesta.borrador.value])
        ).all()
        for p in otras:
            p.estado = EstadoPropuesta.rechazada

        # Orden creada en la misma transacción → estado operativo de la cotización.
        cotizacion.estado = EstadoCotizacion.orden_activa
        # En abiertas el importador_id era NULL; fijarlo a la empresa ganadora.
        cotizacion.importador_id = propuesta.importador_id

        nueva_orden = db.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
        if not nueva_orden:
            nueva_orden = Orden(
                id=str(gen_uuid()),
                cotizacion_id=cotizacion.id,
                importador_id=propuesta.importador_id,
                solicitante_id=cotizacion.solicitante_id,
                asesor_asignado_id=cotizacion.asesor_asignado_id,
                estado=EstadoOrden.cotizacion_aceptada,
                precio_acordado_usd=propuesta.precio_ofrecido_usd,
                tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
                condiciones_adicionales=propuesta.condiciones_adicionales
            )
            db.add(nueva_orden)
            db.flush()
            db.add(HistorialEstadosOrden(
                orden_id=nueva_orden.id,
                estado_anterior=None,
                estado_nuevo=EstadoOrden.cotizacion_aceptada.value
            ))

        # Traspaso de chat al dueño (supervisor): a partir de aquí, el asesor deja
        # de negociar y responde la cuenta dueña de la empresa importadora.
        dueño = db.query(UsuarioModel).filter(
            UsuarioModel.importador_id == propuesta.importador_id,
            UsuarioModel.rol == "importador"
        ).first()
        dueño_id = str(dueño.id) if dueño else None

        conversacion = db.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == cotizacion.id
        ).first()

        if not conversacion and dueño_id:
            conversacion = ConversacionChat(
                id=str(gen_uuid()),
                cotizacion_id=cotizacion.id,
                solicitante_id=cotizacion.solicitante_id,
                importador_usuario_id=dueño_id
            )
            db.add(conversacion)
            db.flush()
        elif conversacion and dueño_id:
            conversacion.importador_usuario_id = dueño_id

        if conversacion:
            conversacion.orden_id = nueva_orden.id
            db.add(MensajeChat(
                id=str(gen_uuid()),
                conversacion_id=conversacion.id,
                remitente_id=dueño_id or user_id_str,
                contenido=(
                    "Propuesta aceptada por ambas partes. Se creó la orden y esta "
                    "conversación ahora queda a cargo del representante de la "
                    "empresa importadora."
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
