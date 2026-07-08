from datetime import datetime

from fastapi import APIRouter

router = APIRouter(prefix="/legal", tags=["Legal"])

# Contenido placeholder: la redacción legal real (política de tratamiento de datos
# y términos y condiciones) está pendiente de revisión jurídica. Estos endpoints
# existen para que el frontend pueda enlazar/mostrar algo real desde el registro
# y el footer mientras tanto, en vez de un enlace roto.
_PLACEHOLDER_VERSION = "0.1-borrador"
_PLACEHOLDER_FECHA = datetime(2026, 7, 8)


@router.get("/politica-tratamiento-datos")
async def politica_tratamiento_datos():
    """Placeholder de la política de tratamiento de datos personales (en construcción)."""
    return {
        "titulo": "Política de Tratamiento de Datos Personales",
        "contenido": (
            "Este documento está en construcción. ImportacionesQ8 publicará aquí la "
            "política completa de tratamiento de datos personales antes del lanzamiento "
            "a producción, conforme a la normativa aplicable."
        ),
        "version": _PLACEHOLDER_VERSION,
        "fecha_actualizacion": _PLACEHOLDER_FECHA,
    }


@router.get("/terminos-condiciones")
async def terminos_condiciones():
    """Placeholder de los términos y condiciones de uso de la plataforma (en construcción)."""
    return {
        "titulo": "Términos y Condiciones de Uso",
        "contenido": (
            "Este documento está en construcción. ImportacionesQ8 solo actúa como "
            "intermediario que conecta solicitantes con empresas importadoras; no se "
            "hace responsable por el cumplimiento de los acuerdos comerciales que las "
            "partes concreten entre sí. El texto legal completo se publicará aquí antes "
            "del lanzamiento a producción."
        ),
        "version": _PLACEHOLDER_VERSION,
        "fecha_actualizacion": _PLACEHOLDER_FECHA,
    }
