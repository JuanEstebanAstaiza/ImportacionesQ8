from datetime import datetime

from fastapi import APIRouter

import config

router = APIRouter(prefix="/legal", tags=["Legal"])

# El texto completo de los documentos legales vive en el frontend
# (src/features/legal/documentos.ts), que lo muestra sin depender de la API.
# Estos endpoints solo publican la versión vigente, un resumen y dónde leerlos,
# para que versión y fecha no se desincronicen: al publicar una nueva versión
# hay que actualizar ambos lados.
_VERSION = "1.0"
_FECHA = datetime(2026, 10, 5)


def _documento(titulo: str, contenido: str, ruta: str) -> dict:
    return {
        "titulo": titulo,
        "contenido": contenido,
        "version": _VERSION,
        "fecha_actualizacion": _FECHA,
        "url": f"{config.FRONTEND_URL.rstrip('/')}{ruta}",
    }


@router.get("/politica-tratamiento-datos")
async def politica_tratamiento_datos():
    """Versión vigente de la política de tratamiento de datos personales (Ley 1581 de 2012)."""
    return _documento(
        "Política de Tratamiento de Datos Personales",
        "Qué datos personales recoge Zarpi, para qué los usa, con quién los comparte "
        "y cómo ejercer los derechos de conocer, actualizar, rectificar y suprimir "
        "conforme a la Ley 1581 de 2012.",
        "/politica-de-datos",
    )


@router.get("/terminos-condiciones")
async def terminos_condiciones():
    """Versión vigente de los términos y condiciones de uso de la plataforma."""
    return _documento(
        "Términos y Condiciones de Uso",
        "Zarpi es una plataforma de contacto entre solicitantes y empresas "
        "importadoras: no es importador de registro ni custodia los pagos de la "
        "operación, que se acuerdan entre las partes.",
        "/terminos",
    )


@router.get("/politica-pagos-reembolsos")
async def politica_pagos_reembolsos():
    """Versión vigente de la política de pagos, cancelaciones y reembolsos."""
    return _documento(
        "Política de Pagos, Cancelaciones y Reembolsos",
        "Qué cobra Zarpi, cómo se paga a través de ePayco y cuándo proceden el "
        "retracto, la reversión del pago y los reembolsos.",
        "/politica-de-pagos",
    )
