"""Expediente de verificación de una empresa importadora.

Verificar es poner un sello de "socio verificado" que el cliente ve al elegir con
quién contratar. Hasta ahora el panel solo tenía un botón que cambiaba el flag:
quien lo pulsaba no sabía qué estaba certificando.

Esto reúne, a partir de datos que ya existen, lo que se puede comprobar sin
salir de la plataforma. No decide por el administrador —la verificación sigue
siendo un juicio suyo, y hay cosas que solo se comprueban fuera, como el
registro mercantil— pero le enseña el expediente antes de firmar.

Los requisitos se dividen en dos:

- **Obligatorios**: sin ellos la empresa ni siquiera puede operar bien en la
  plataforma (no aparecería en el matching, no podría rotular un embarque).
- **Recomendables**: hablan de una empresa con recorrido, no de una recién
  registrada. Que falten no impide verificar, pero conviene verlo.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session


def _lista(valor) -> list:
    return [v for v in (valor or []) if str(v).strip()] if isinstance(valor, (list, tuple)) else []


def construir_expediente(db: Session, importador) -> dict:
    """Todo lo comprobable sobre una empresa, con su veredicto por requisito."""
    from models.evidencia import EstadoEvidenciaImportador, EvidenciaImportador
    from models.orden import Orden
    from models.propuesta import Propuesta
    from models.resena import ResenaImportador
    from models.usuario import Usuario

    perfil = importador.perfil_publico if isinstance(importador.perfil_publico, dict) else {}

    dueño = (
        db.query(Usuario)
        .filter(Usuario.importador_id == importador.id, Usuario.rol == "importador")
        .first()
    )
    asesores_activos = (
        db.query(Usuario)
        .filter(
            Usuario.importador_id == importador.id,
            Usuario.rol == "asesor",
            Usuario.activo.is_(True),
        )
        .count()
    )

    evidencias_aprobadas = (
        db.query(EvidenciaImportador)
        .filter(
            EvidenciaImportador.importador_id == importador.id,
            EvidenciaImportador.estado == EstadoEvidenciaImportador.aprobada.value,
        )
        .count()
    )

    propuestas = db.query(Propuesta).filter(Propuesta.importador_id == importador.id).count()
    ordenes = db.query(Orden).filter(Orden.importador_id == importador.id).count()
    disputas_abiertas = (
        db.query(Orden)
        .filter(Orden.importador_id == importador.id, Orden.en_disputa.is_(True))
        .count()
    )

    notas = [
        fila[0]
        for fila in db.query(ResenaImportador.calificacion)
        .filter(
            ResenaImportador.importador_id == importador.id,
            ResenaImportador.visible.is_(True),
        )
        .all()
    ]

    especialidades = _lista(importador.especialidad_producto)
    paises = _lista(importador.paises_origen)

    obligatorios = [
        {
            "clave": "cuenta_duena",
            "titulo": "Cuenta dueña activa",
            "detalle": "Representante legal con acceso a la plataforma.",
            "cumple": bool(dueño and dueño.activo),
            "valor": (dueño.email if dueño else "Sin cuenta dueña"),
        },
        {
            "clave": "correo_verificado",
            "titulo": "Correo del representante verificado",
            "detalle": "Confirma que hay alguien real detrás de la cuenta.",
            "cumple": bool(dueño and dueño.email_verificado),
            "valor": "Verificado" if (dueño and dueño.email_verificado) else "Sin verificar",
        },
        {
            "clave": "especialidad",
            "titulo": "Especialidad declarada",
            "detalle": "Sin ella la empresa no entra en el reparto de cotizaciones abiertas.",
            "cumple": len(especialidades) > 0,
            "valor": ", ".join(especialidades) or "Ninguna",
        },
        {
            "clave": "paises",
            "titulo": "Países de origen",
            "detalle": "Desde dónde importa.",
            "cumple": len(paises) > 0,
            "valor": ", ".join(paises) or "Ninguno",
        },
        {
            "clave": "shipping_mark",
            "titulo": "Prefijo de marca de embarque",
            "detalle": "Necesario para rotular las cajas de sus clientes.",
            "cumple": bool((importador.shipping_mark_prefijo or "").strip()),
            "valor": importador.shipping_mark_prefijo or "Sin definir",
        },
        {
            "clave": "sin_incidentes",
            "titulo": "Sin incidentes abiertos",
            "detalle": "No hay órdenes suyas en disputa ahora mismo.",
            "cumple": disputas_abiertas == 0,
            "valor": "Ninguno" if disputas_abiertas == 0 else f"{disputas_abiertas} en disputa",
        },
    ]

    recomendables = [
        {
            "clave": "logo",
            "titulo": "Logo",
            "detalle": "Identifica a la empresa en el catálogo.",
            "cumple": bool((importador.logo_url or "").strip()),
            "valor": "Cargado" if (importador.logo_url or "").strip() else "Sin logo",
        },
        {
            "clave": "descripcion",
            "titulo": "Descripción pública",
            "detalle": "Lo primero que lee un cliente en su ficha.",
            "cumple": bool(str(perfil.get("description") or "").strip()),
            "valor": "Redactada" if str(perfil.get("description") or "").strip() else "Vacía",
        },
        {
            "clave": "evidencias",
            "titulo": "Material de presentación aprobado",
            "detalle": "Fotos o video de su operación, ya revisados.",
            "cumple": evidencias_aprobadas > 0,
            "valor": f"{evidencias_aprobadas} aprobadas",
        },
        {
            "clave": "equipo",
            "titulo": "Equipo de asesores",
            "detalle": "Alguien que atienda las cotizaciones que reciba.",
            "cumple": asesores_activos > 0,
            "valor": f"{asesores_activos} activos",
        },
        {
            "clave": "actividad",
            "titulo": "Actividad en la plataforma",
            "detalle": "Propuestas enviadas y órdenes gestionadas.",
            "cumple": propuestas > 0,
            "valor": f"{propuestas} propuestas · {ordenes} órdenes",
        },
        {
            "clave": "resenas",
            "titulo": "Reseñas de clientes",
            "detalle": "Opinión de quienes ya contrataron con ella.",
            "cumple": len(notas) > 0,
            "valor": (
                f"{len(notas)} reseñas · promedio {round(sum(notas) / len(notas), 1)}"
                if notas
                else "Sin reseñas"
            ),
        },
    ]

    pendientes = [r["titulo"] for r in obligatorios if not r["cumple"]]

    return {
        "importador_id": str(importador.id),
        "nombre_empresa": importador.nombre_empresa,
        "verificado": bool(importador.verificado),
        "estado": importador.estado or "activo",
        "obligatorios": obligatorios,
        "recomendables": recomendables,
        "obligatorios_cumplidos": sum(1 for r in obligatorios if r["cumple"]),
        "obligatorios_totales": len(obligatorios),
        "recomendables_cumplidos": sum(1 for r in recomendables if r["cumple"]),
        "recomendables_totales": len(recomendables),
        # Cumplir lo obligatorio habilita el botón, no verifica sola a la
        # empresa: la decisión sigue siendo de quien administra.
        "listo_para_verificar": len(pendientes) == 0,
        "pendientes": pendientes,
    }


def expediente_de(db: Session, importador_id: str) -> Optional[dict]:
    from models.importador import Importador

    importador = db.query(Importador).filter(Importador.id == importador_id).first()
    if not importador:
        return None
    return construir_expediente(db, importador)
