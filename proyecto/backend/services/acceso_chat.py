"""Quién puede entrar en una conversación.

La regla vivía dentro de `routers/chat.py` y `routers/documentos.py` tenía su
propia copia, más estrecha: pedía que la conversación estuviera justo a nombre
del usuario (`importador_usuario_id`). Con eso, un caso que los mensajes sí
dejaban leer se quedaba sin sus adjuntos —la cuenta dueña de la empresa
supervisando el hilo de su asesor, los dos lados del canal interno, o un agente
de soporte en su propio ticket—, y el panel de adjuntos reintentaba contra un
403 en bucle.

Dos copias de un permiso divergen siempre; aquí hay una sola y los dos routers
la usan.
"""
from typing import Optional, Set

from sqlalchemy.orm import Session

from models.chat import ConversacionChat, TipoConversacion
from models.usuario import ROLES_EQUIPO, ROLES_PLATAFORMA, Usuario


def es_equipo_plataforma(rol: str) -> bool:
    """¿Es una cuenta interna de Zarpi (administración o soporte)?

    Los agentes de soporte atienden los mismos hilos que un administrador; lo
    que no pueden es administrar la plataforma. Esa distinción vive en los
    endpoints, no aquí.
    """
    return rol in ROLES_PLATAFORMA


def es_miembro_equipo(rol: str) -> bool:
    """¿Entra al canal del equipo? Administración, soporte y diseño. Solo eso:
    el designer no ve tickets ni conversaciones de clientes y empresas."""
    return rol in ROLES_EQUIPO


def tipo_de(conversacion: ConversacionChat) -> str:
    return str(conversacion.tipo or TipoConversacion.negociacion.value)


def es_interna(conversacion: ConversacionChat) -> bool:
    return tipo_de(conversacion) == TipoConversacion.interna.value


def es_soporte(conversacion: ConversacionChat) -> bool:
    return tipo_de(conversacion) == TipoConversacion.soporte.value


def es_equipo(conversacion: ConversacionChat) -> bool:
    """Canal interno del equipo de la plataforma (administración ↔ soporte)."""
    return tipo_de(conversacion) == TipoConversacion.equipo.value


def es_sala_del_equipo(conversacion: ConversacionChat) -> bool:
    """La sala común, en la que está todo el equipo (sin miembros concretos)."""
    return es_equipo(conversacion) and not conversacion.solicitante_id and not conversacion.importador_usuario_id


def miembros_ordenados(a: str, b: str) -> tuple:
    """Los dos miembros de un hilo del equipo, siempre en el mismo orden.

    Ordenarlos hace que el par sea único: sin esto, "Ana escribe a Beto" y
    "Beto escribe a Ana" crearían dos hilos distintos para la misma pareja y
    cada uno vería la mitad de la conversación.
    """
    return (a, b) if str(a) <= str(b) else (b, a)


def participantes(db: Session, conversacion: ConversacionChat) -> Set[str]:
    """Las personas que son parte del hilo, sin nulos.

    Qué columnas llevan a alguien depende del tipo de conversación: en un ticket
    de soporte no hay lado empresa (`importador_usuario_id` va en nulo) y en el
    canal interno no hay solicitante. Leer las dos columnas a ciegas metía un
    `None` en la lista, y quien la usaba para repartir copias de un adjunto
    terminaba insertando un archivo sin dueño (`owner_user_id` NOT NULL): 500 al
    compartir cualquier recurso en un ticket o en el canal interno.
    """
    ids: Set[Optional[str]] = set()

    if es_equipo(conversacion):
        if es_sala_del_equipo(conversacion):
            ids |= {
                fila[0]
                for fila in db.query(Usuario.id).filter(
                    Usuario.rol.in_(ROLES_EQUIPO),
                    Usuario.activo.is_(True),
                )
            }
        else:
            ids |= {conversacion.solicitante_id, conversacion.importador_usuario_id}
    elif es_soporte(conversacion):
        ids |= {conversacion.solicitante_id, conversacion.agente_asignado_id}
    elif es_interna(conversacion):
        # El otro extremo es la empresa; se resuelve a su cuenta dueña, que es
        # quien tiene gestión documental propia.
        ids.add(conversacion.importador_usuario_id)
        if conversacion.importador_id:
            ids |= {
                fila[0]
                for fila in db.query(Usuario.id).filter(
                    Usuario.importador_id == conversacion.importador_id,
                    Usuario.rol == "importador",
                    Usuario.activo.is_(True),
                )
            }
    else:
        ids |= {conversacion.solicitante_id, conversacion.importador_usuario_id}

    return {str(i) for i in ids if i}


def puede_acceder(
    conversacion: ConversacionChat,
    current_user: dict,
    db: Optional[Session] = None,
) -> bool:
    """Solo el solicitante y el usuario de la empresa (dueño o asesor asignado)
    de esa conversación pueden leer/escribir mensajes en ella (evita IDOR entre
    conversaciones de otros clientes/empresas).

    Sin `db` no se puede comprobar que un asesor sea de la misma empresa que la
    cuenta dueña, así que ese caso se deniega: es el lado seguro.
    """
    user_id = current_user["user_id"]
    rol = current_user["rol"]

    if es_equipo(conversacion):
        # Canal del equipo: fuera de la plataforma nadie entra, ni siquiera el
        # usuario del que se esté hablando. La sala común la ve todo el equipo;
        # un hilo entre dos personas, solo esas dos.
        if not es_miembro_equipo(rol):
            return False
        if es_sala_del_equipo(conversacion):
            return True
        return user_id in (conversacion.solicitante_id, conversacion.importador_usuario_id)

    if es_soporte(conversacion):
        # Un ticket lo ven quien lo abrió y el equipo de la plataforma. Nadie más:
        # el usuario puede haber contado ahí datos de su operación.
        return es_equipo_plataforma(rol) or conversacion.solicitante_id == user_id

    if es_interna(conversacion):
        # Canal de coordinación de la empresa: el cliente nunca entra, ni
        # siquiera al hilo interno de la orden que él mismo encargó.
        if rol == "asesor":
            return conversacion.importador_usuario_id == user_id
        if rol == "importador":
            return bool(
                conversacion.importador_id
                and current_user.get("importador_id") == conversacion.importador_id
            )
        return es_equipo_plataforma(rol)

    if rol == "solicitante":
        return conversacion.solicitante_id == user_id
    if rol == "asesor":
        return conversacion.importador_usuario_id == user_id
    if rol == "importador":
        if conversacion.importador_usuario_id == user_id:
            return True
        # El dueño supervisa las conversaciones de sus asesores: sin esto, un
        # asesor desactivado dejaba el hilo ilegible para toda la empresa.
        importador_id = current_user.get("importador_id")
        if db is None or not importador_id:
            return False
        contraparte = db.query(Usuario).filter(
            Usuario.id == conversacion.importador_usuario_id
        ).first()
        return bool(contraparte and contraparte.importador_id == importador_id)
    return es_equipo_plataforma(rol)
