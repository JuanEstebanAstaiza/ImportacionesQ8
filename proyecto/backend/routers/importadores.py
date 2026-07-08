import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional
from uuid import UUID
import json

import config
from schemas.importador import ImportadorCreate, ImportadorResponse, ImportadorUpdate
from schemas.usuario import AsesorCreate, AsesorResponse, AsesorEstadoUpdate
from schemas.campo_personalizado import (
    CampoPersonalizadoCreate, CampoPersonalizadoUpdate, CampoPersonalizadoResponse,
    FormularioImportadorResponse
)
from models.importador import Importador
from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.campo_personalizado import CampoPersonalizado
from utils.dependencies import get_db, require_rol, require_rol_in, get_current_user
from utils.security import hash_password

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/importadores", tags=["Importadores"])

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite
    
    En MySQL usa json_contains. En SQLite usa LIKE porque no tiene json_contains.
    """
    # Usar LIKE para buscar el valor dentro del JSON (compatible con ambos)
    return column.like(f'%"{value}"%')

@router.get("/", response_model=List[ImportadorResponse])
async def listar_importadores(
    especialidad: Optional[str] = Query(None, description="Filtrar por especialidad de producto"),
    pais: Optional[str] = Query(None, description="Filtrar por país de origen"),
    orden: Optional[str] = Query(None, description="'calificacion' o 'reciente'"),
    certificado: Optional[bool] = Query(None, description="Filtrar por empresas verificadas (true/false)"),
    db: Session = Depends(get_db)
):
    """
    Lista todos los importadores activos con filtros opcionales.
    
    - **especialidad**: Filtrar por especialidad de producto (ej: "Textiles")
    - **pais**: Filtrar por país de origen (ej: "China")
    - **orden**: 'calificacion' (mejor calificados primero) o 'reciente' (más nuevos primero)
    - **certificado**: `true` para solo empresas verificadas, `false` para no verificadas
    """
    query = db.query(Importador).filter(Importador.estado == "activo")
    
    if especialidad:
        # Buscar en JSON usando LIKE (compatible con MySQL y SQLite)
        query = query.filter(json_contains_column(Importador.especialidad_producto, especialidad))
    
    if pais:
        query = query.filter(json_contains_column(Importador.paises_origen, pais))

    if certificado is not None:
        query = query.filter(Importador.verificado == certificado)

    if orden == "calificacion":
        query = query.order_by(Importador.calificacion_promedio.desc())
    elif orden == "reciente":
        query = query.order_by(Importador.fecha_registro.desc())

    importadores = query.all()
    return importadores

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

@router.put("/asesores/{asesor_id}/estado", response_model=AsesorResponse)
async def actualizar_estado_asesor(
    asesor_id: str,
    datos: AsesorEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """Activa o desactiva un asesor de la empresa (solo la cuenta dueña, y solo de su propia empresa)."""
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

    asesor.activo = datos.activo
    db.commit()
    db.refresh(asesor)

    return asesor

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
    Top empresas importadoras activas por calificación promedio, para la sección
    "Mejor calificados" del dashboard del solicitante.
    """
    return db.query(Importador).filter(
        Importador.estado == "activo"
    ).order_by(Importador.calificacion_promedio.desc()).limit(limite).all()

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

    agrupado: dict[str, list] = {}
    for imp in importadores:
        categorias = imp.especialidad_producto or []
        for categoria in categorias:
            agrupado.setdefault(categoria, []).append(ImportadorResponse.model_validate(imp).model_dump(mode="json"))

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
    return db.query(Importador).filter(
        Importador.estado == "activo",
        Importador.verificado == True  # noqa: E712 - comparación explícita requerida por SQLAlchemy
    ).order_by(Importador.calificacion_promedio.desc()).all()

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
    
    return importador

@router.post("/", response_model=ImportadorResponse, status_code=status.HTTP_201_CREATED)
async def crear_importador(
    importador_data: ImportadorCreate,
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo importador en el sistema. Solo administradores pueden crear importadores.
    
    - **nombre_empresa**: Nombre de la empresa importadora
    - **logo_url**: URL del logo (opcional)
    - **especialidad_producto**: Lista de categorías de producto
    - **paises_origen**: Lista de países de origen
    - **tiempo_respuesta_promedio**: Tiempo promedio de respuesta (ej: "24h")
    - **calificacion_promedio**: Calificación promedio (default: 0.0)
    - **capacidad_volumen**: Capacidad máxima de volumen por pedido (opcional)
    """
    from uuid import uuid4
    
    nuevo_importador = Importador(
        id=str(uuid4()),  # Convertir a string para SQLite
        nombre_empresa=importador_data.nombre_empresa,
        logo_url=importador_data.logo_url,
        especialidad_producto=importador_data.especialidad_producto,
        paises_origen=importador_data.paises_origen,
        calificacion_promedio=importador_data.calificacion_promedio,
        tiempo_respuesta_promedio=importador_data.tiempo_respuesta_promedio,
        capacidad_volumen=importador_data.capacidad_volumen,
        estado="activo"
    )
    
    db.add(nuevo_importador)
    db.commit()
    db.refresh(nuevo_importador)
    
    return nuevo_importador

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
    
    # Filtrar por matching real usando Redis: solo mostrar cotizaciones donde este
    # importador específico aparece en la lista de matching (país + categoría).
    # Si Redis no está disponible, se degrada a "sin resultados" en vez de un error 500.
    cotizaciones_matching = {}
    if config.redis_client:
        try:
            all_keys = config.redis_client.keys("cotizacion_abierta:*")
            for key in all_keys:
                # Ignorar claves auxiliares (":expiracion", ":respuestas")
                partes = key.split(":")
                if len(partes) != 2:
                    continue
                cid = partes[1]
                importadores_hash = config.redis_client.hgetall(key)
                cotizaciones_matching[cid] = list(importadores_hash.keys())
        except Exception:
            logger.warning("Redis no disponible al listar solicitudes abiertas para importador %s", importador_id_str)
    
    resultados = []
    for c in cotizaciones:
        # Verificar si este importador está en la lista de matching para esta cotización
        if config.redis_client and importador_id_str not in cotizaciones_matching.get(str(c.id), []):
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
    
    from models.orden import Orden, EstadoOrden
    
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
    for campo, valor in datos_actualizados.items():
        setattr(importador, campo, valor)

    db.commit()
    db.refresh(importador)

    return importador

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
