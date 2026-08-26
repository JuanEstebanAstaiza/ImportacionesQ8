#!/usr/bin/env python3
"""Carga inicial de la documentación de ayuda.

    docker compose exec backend sh -c 'cd /app && PYTHONPATH=/app python scripts/seed_ayuda.py'

Contiene lo que antes vivía en `help-support-content.ts` más, sobre todo, las
situaciones que de verdad generan tickets: por qué una cotización no recibe
propuestas, por qué un asesor no puede cerrar la orden, por qué un archivo pide
sesión al abrirlo. Son las dudas que aparecieron una y otra vez montando la
plataforma, escritas para que quien las sufra pueda resolverlas solo y para que
soporte tenga a qué remitir.

Es idempotente: se identifica cada artículo por su título, así que reejecutarlo
actualiza el texto en lugar de duplicarlo. Lo que el equipo haya escrito o
editado desde el panel no se toca, salvo que coincida el título.
"""
from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal  # noqa: E402
from models.ayuda import ArticuloAyuda  # noqa: E402

TODOS: list = []
CLIENTE = ["solicitante"]
EMPRESA = ["importadora"]
ASESOR = ["asesor"]
EMPRESA_Y_ASESOR = ["importadora", "asesor"]

# Agrupados por categoría: repetirla en cada fila era pedir que se olvidara.
# Cada artículo es (título, resumen, contenido, roles, orden).
ARTICULOS_POR_CATEGORIA = {
    "Primeros pasos": [
    (
        "Qué es cada perfil de la plataforma",
        "Solicitante pide cotizaciones; la empresa importadora las responde; el asesor es empleado de esa empresa y negocia por ella.",
        "Hay cuatro perfiles:\n\n"
        "• **Solicitante**: quien necesita importar. Crea cotizaciones y elige con qué empresa trabaja.\n"
        "• **Empresa importadora (cuenta dueña)**: el representante legal. Responde cotizaciones, da de alta a sus asesores y es quien confirma la orden.\n"
        "• **Asesor**: empleado de una empresa importadora. Toma cotizaciones, negocia con el cliente y hace el seguimiento del embarque.\n"
        "• **Equipo de ImportacionesQ8**: administración y atención al cliente.\n\n"
        "Una cuenta pertenece a un solo perfil. Si necesitas otro, se crea una cuenta aparte.",
        TODOS,
        1,
    ),
    (
        "Cómo pido ayuda si algo no funciona",
        "Botón «Pedir soporte técnico» en esta misma pantalla o al final del menú lateral. Se atiende por urgencia.",
        "Abre un ticket desde el botón de arriba o desde «Soporte técnico», al final del menú lateral.\n\n"
        "Al abrirlo eliges una urgencia. Márcala con criterio, porque de ella depende quién lo atiende y en qué orden:\n\n"
        "• **Crítica**: no puedes operar. Un embarque parado, no puedes entrar a la cuenta.\n"
        "• **Alta**: algo importante falla pero tienes cómo seguir.\n"
        "• **Media**: una duda o un error que molesta sin bloquear.\n"
        "• **Baja**: una consulta general.\n\n"
        "Cuenta qué intentabas hacer, qué viste y desde qué pantalla. Con eso se resuelve mucho más rápido que con «no funciona».\n\n"
        "El ticket es una conversación: te responden ahí mismo y queda el historial. Al cerrarse puedes puntuar la atención.",
        TODOS,
        2,
    ),
    ],
    "Cotizaciones": [
    (
        "Cotización abierta o dirigida: cuál usar",
        "Abierta para comparar varias ofertas; dirigida cuando ya sabes con qué empresa quieres trabajar.",
        "**Abierta**: se difunde a las empresas cuya especialidad coincide con tu línea de producto. Recibes varias propuestas y comparas.\n\n"
        "**Dirigida**: va a una empresa concreta. Úsala cuando ya tienes relación con ella o te la recomendaron.\n\n"
        "Una cotización dirigida a una empresa cuya especialidad no cubre tu línea de producto se rechaza al crearla, y el mensaje te dice qué categorías atiende esa empresa.",
        CLIENTE,
        1,
    ),
    (
        "Qué es el shipping mark y por qué me lo piden",
        "Es la marca que va rotulada en tus cajas: el prefijo de la empresa más el sufijo que tú eliges.",
        "La empresa importadora tiene un prefijo fijo (por ejemplo `ctl`) y tú añades un sufijo que identifique tu carga (por ejemplo «prendas control»). El resultado es `ctl-prendascontrol`.\n\n"
        "Sirve para que en bodega distingan tu mercancía de la de otros clientes de la misma empresa.\n\n"
        "Se normaliza automáticamente: se quitan tildes, espacios y mayúsculas. Al crearse la orden **queda congelado**: si la empresa cambia su prefijo después, tus cajas ya rotuladas y tus documentos siguen cuadrando.",
        CLIENTE,
        2,
    ),
    (
        "No recibo propuestas a mi cotización",
        "La causa más común es que ninguna empresa tenga declarada tu línea de producto como especialidad.",
        "Revisa en este orden:\n\n"
        "1. **Línea de producto**: es lo que decide a qué empresas les llega. Si elegiste una categoría que ninguna empresa atiende, la cotización no le aparece a nadie.\n"
        "2. **Descripción**: necesita al menos 10 caracteres y conviene que diga volumen, calidad y plazo. Una ficha vaga se responde tarde o no se responde.\n"
        "3. **País e incoterm**: sin ellos la empresa no puede cotizar y suele dejarla pasar.\n"
        "4. **Modalidad**: si la creaste dirigida, solo la ve esa empresa.\n\n"
        "Si todo está completo y sigue sin respuesta, duplícala ajustando la línea de producto, o abre un ticket de soporte con el código de la cotización.",
        CLIENTE,
        3,
    ),
    (
        "Cómo tomo una cotización del pool",
        "En «Disponibles», el primero que la reclama se la queda, y el chat con el cliente se abre solo.",
        "Las cotizaciones que llegan a tu empresa y aún no tienen responsable aparecen en «Disponibles».\n\n"
        "Al reclamar una:\n\n"
        "• Quedas como asesor asignado.\n"
        "• **Se abre automáticamente el chat con el cliente**, sin esperar a que él escriba. No tienes que iniciarlo.\n"
        "• El cliente recibe un aviso de que ya tiene a alguien atendiéndole.\n\n"
        "Es un reclamo atómico: si dos personas pulsan a la vez, solo una se la queda y la otra ve un aviso de que ya fue reclamada.",
        ASESOR,
        1,
    ),
    ],
    "Propuestas y negociación": [
    (
        "Quién puede enviar una propuesta",
        "El asesor la redacta como borrador y la cuenta dueña la revisa y la envía.",
        "El circuito es deliberado:\n\n"
        "1. El asesor redacta la propuesta. Queda en estado **borrador**, que el cliente todavía no ve.\n"
        "2. La cuenta dueña la revisa y la envía. Ahí pasa a **pendiente** y el cliente la recibe.\n\n"
        "Si eres la cuenta dueña puedes enviar una propuesta directamente, sin pasar por borrador.\n\n"
        "Si ves el aviso de que ya existe un borrador para esa cotización, no crees otra: revísalo y envíalo desde el panel.",
        EMPRESA_Y_ASESOR,
        1,
    ),
    (
        "Por qué mi propuesta necesita dos aceptaciones",
        "Acepta el cliente y confirma la cuenta dueña de la empresa. Solo entonces se crea la orden.",
        "Una propuesta se cierra con **doble aceptación**:\n\n"
        "1. El cliente acepta tras negociar por el chat.\n"
        "2. La **cuenta dueña** de la empresa revisa esa negociación y confirma.\n\n"
        "Al confirmarse se crea la orden automáticamente, se rechazan las demás propuestas de esa cotización y se congela la marca de embarque.\n\n"
        "Mientras la otra parte no haya aceptado, cualquiera de las dos puede retirar su marca. Una vez cerrada, queda bloqueada.",
        TODOS,
        2,
    ),
    (
        "Soy asesor y no puedo cerrar la orden",
        "Es correcto: la confirmación final es de la cuenta dueña, que revisa tu negociación antes de comprometer a la empresa.",
        "Verás un mensaje como: «La aceptación final la confirma la cuenta dueña de la empresa».\n\n"
        "No es un fallo. El asesor negocia y su conversación queda como evidencia; quien compromete a la empresa es su representante, que la revisa antes de firmar.\n\n"
        "Qué hacer: avisa a la cuenta dueña. Le llega el aviso en cuanto el cliente acepta, y lo confirma desde **Cotizaciones → Esperan tu confirmación**.\n\n"
        "Cerrada la orden, el chat **sigue contigo**: pasa a ser el del seguimiento del embarque.",
        ASESOR,
        3,
    ),
    (
        "Dónde confirmo las propuestas que esperan mi firma",
        "En Cotizaciones, en el bloque «Esperan tu confirmación», arriba del listado.",
        "Cuando un cliente acepta lo que negoció tu asesor, la cotización aparece en **Cotizaciones → Esperan tu confirmación**.\n\n"
        "Desde ahí tienes dos botones:\n\n"
        "• **Ver negociación**: abre el chat del asesor con el cliente. Es la evidencia de lo que se acordó.\n"
        "• **Confirmar y crear orden**: cierra el trato.\n\n"
        "Revisa el chat antes de confirmar: el precio y los plazos que se hayan hablado ahí son los que vas a asumir.",
        EMPRESA,
        4,
    ),
    ],
    "Órdenes y seguimiento": [
    (
        "Los estados de una orden y en qué orden van",
        "Cotización aceptada → En producción → Tránsito internacional → Aduana → Bodega local → Entregado. Se avanza de uno en uno.",
        "La orden recorre seis estados, siempre hacia adelante y sin saltos:\n\n"
        "1. **Cotización aceptada**: se acaba de crear.\n"
        "2. **En producción**: el proveedor está fabricando.\n"
        "3. **Tránsito internacional**: la mercancía salió.\n"
        "4. **Aduana / nacionalización**: en trámite de importación.\n"
        "5. **Bodega local**: llegó al país.\n"
        "6. **Entregado**: cerrada.\n\n"
        "No se puede retroceder ni saltar pasos. Cada cambio queda en el historial de la orden y se anota en el chat, así que el cliente lo ve sin preguntar.",
        TODOS,
        1,
    ),
    (
        "Quién actualiza el estado de una orden",
        "La cuenta dueña de la empresa y el asesor asignado a esa orden.",
        "Pueden moverla:\n\n"
        "• El **asesor asignado** a esa orden, que es quien hace el seguimiento.\n"
        "• La **cuenta dueña** de la empresa.\n\n"
        "Un asesor no puede mover órdenes que no son suyas.\n\n"
        "Se hace desde el detalle de la orden (botón «Marcar …» bajo el estado logístico) o desde el panel lateral del chat de seguimiento. Solo se ofrece el siguiente estado válido: no hay forma de equivocarse de salto.",
        EMPRESA_Y_ASESOR,
        2,
    ),
    (
        "Cómo coordino a mis asesores sobre una orden",
        "Con el canal interno: un chat privado con cada asesor que el cliente no ve.",
        "Desde **Asesores**, el icono de mensaje abre un canal privado con esa persona. El asesor lo abre desde su panel con «Canal con mi empresa».\n\n"
        "Es donde le dices cuándo mover el estado: «ya salió de fábrica», «llegó el aviso de aduana».\n\n"
        "Va aparte del chat con el cliente **a propósito**: el solicitante no ve nada de la coordinación interna. Hay un canal por asesor, no uno por orden, para que el historial de instrucciones quede junto.",
        EMPRESA_Y_ASESOR,
        3,
    ),
    (
        "No veo actualizado el seguimiento de mi orden",
        "Comprueba el estado en el detalle de la orden; el historial y el chat registran cada cambio con su fecha.",
        "Cada cambio de estado deja tres rastros: el estado actual en el detalle de la orden, una entrada en el historial de eventos con fecha, y un mensaje en el chat de seguimiento.\n\n"
        "Si el estado no avanza, no es que no se vea: es que la empresa aún no lo ha movido. Pregúntaselo por el chat de la orden, que es el mismo hilo donde negociaste.\n\n"
        "Si además hay un problema con la mercancía, usa «Reportar problema» en la orden: eso abre un incidente que revisa el equipo de ImportacionesQ8.",
        CLIENTE,
        4,
    ),
    ],
    "Chats": [
    (
        "Los tres tipos de chat y quién lee cada uno",
        "Negociación (cliente ↔ empresa), interno (empresa ↔ su asesor) y soporte (tú ↔ ImportacionesQ8).",
        "• **Negociación**: entre el solicitante y la empresa. Nace al reclamarse la cotización y, cuando se crea la orden, pasa a ser el del seguimiento del embarque. Mismo hilo, sin perder el contexto.\n"
        "• **Interno**: entre la cuenta dueña y un asesor. El cliente no lo ve ni entrando por la URL.\n"
        "• **Soporte**: entre un usuario y el equipo de ImportacionesQ8. Solo lo ven quien lo abrió y el equipo.\n\n"
        "En la lista de chats se distinguen por color e icono, y puedes filtrarlos por tipo.",
        TODOS,
        1,
    ),
    (
        "Puedo retomar una negociación más tarde",
        "Sí. El historial se conserva por cotización y por orden; no se pierde nada.",
        "El hilo se conserva completo. Al cerrarse el trato no se abre uno nuevo: el mismo cambia de asunto y pasa a seguimiento, con todo lo hablado antes a la vista.\n\n"
        "Los adjuntos que se comparten quedan además en tu gestión documental, en la carpeta de esa conversación.",
        TODOS,
        2,
    ),
    ],
    "Documentos y archivos": [
    (
        "Al abrir un archivo me pide iniciar sesión",
        "Copiar la URL de un archivo y abrirla directamente no funciona: descárgalo desde la plataforma.",
        "Los archivos privados exigen tu sesión para servirse. El navegador no envía las credenciales cuando pegas una dirección en la barra, así que verás «Se requiere iniciar sesión para acceder a este archivo» aunque estés dentro.\n\n"
        "Ábrelos siempre desde los botones de la plataforma (Ver / Descargar). Esos sí envían tu sesión.\n\n"
        "Si te pasa desde un botón de la aplicación y no desde una URL pegada, ahí sí hay un problema: abre un ticket indicando en qué pantalla estabas.",
        TODOS,
        1,
    ),
    (
        "Límites al subir archivos y videos",
        "Los archivos de curso admiten hasta 300 MB; el resto de peticiones tiene un tope mucho menor.",
        "La subida de archivos acepta ficheros grandes (videos de curso incluidos) hasta el tope que muestra la propia pantalla de subida.\n\n"
        "Si al subir un video ves un error de red o de CORS, casi siempre es que superó el tamaño permitido: el servidor corta la petición antes de responder. Comprime el video o divídelo.\n\n"
        "Los archivos subidos se conservan aunque se reinicie la plataforma.",
        TODOS,
        2,
    ),
    ],
    "Cuenta y accesos": [
    (
        "«No autorizado - rol insuficiente»: qué significa",
        "Estás intentando una acción de otro perfil. El mensaje dice qué rol hace falta y cuál es el tuyo.",
        "El aviso completo indica ambas cosas, por ejemplo: «esta operación requiere el rol 'importador o asesor' y tu sesión es de tipo 'solicitante'».\n\n"
        "Causas habituales:\n\n"
        "• Tienes varias cuentas y entraste con la que no era.\n"
        "• Intentas una acción reservada a la cuenta dueña siendo asesor (confirmar una propuesta, por ejemplo).\n"
        "• La sesión quedó de una prueba anterior: cierra sesión y vuelve a entrar.\n\n"
        "Si el mensaje aparece al hacer algo que sí te corresponde, cópialo entero en un ticket: con esos dos datos se localiza de inmediato.",
        TODOS,
        1,
    ),
    (
        "Cómo doy de alta a mis asesores",
        "En Asesores → Nuevo asesor. Necesitas nombre, correo y una contraseña temporal.",
        "Desde **Asesores** creas las cuentas de tu equipo. Cada asesor entra con su propio correo y solo ve lo de tu empresa.\n\n"
        "Desde ahí también puedes:\n\n"
        "• Enviarle un enlace para que defina su contraseña.\n"
        "• Activarlo o desactivarlo. Al desactivarlo, sus cotizaciones y conversaciones abiertas pasan a tu cuenta para que nada quede sin responsable.\n"
        "• Abrir el canal interno para coordinar sus órdenes.",
        EMPRESA,
        2,
    ),
    (
        "Qué necesita mi empresa para estar verificada",
        "Cuenta dueña activa con correo verificado, especialidad, países de origen, prefijo de embarque y ningún incidente abierto.",
        "El sello de «socio verificado» lo otorga el equipo de ImportacionesQ8 y lo ve el cliente al elegir con quién contratar.\n\n"
        "**Requisitos obligatorios:**\n\n"
        "• Cuenta dueña activa.\n"
        "• Correo del representante verificado.\n"
        "• Especialidad de producto declarada (sin ella no entras en el reparto de cotizaciones abiertas).\n"
        "• Países de origen.\n"
        "• Prefijo de marca de embarque.\n"
        "• Ninguna orden tuya en disputa.\n\n"
        "**Suman, pero no bloquean:** logo, descripción pública, material de presentación aprobado, asesores activos, actividad real y reseñas de clientes.\n\n"
        "Completa tu perfil y solicítalo por soporte. La comprobación legal (registro mercantil, referencias) la hace el equipo aparte.",
        EMPRESA,
        3,
    ),
    ],
    "Problemas frecuentes": [
    (
        "No veo el banner ni el video de una empresa",
        "Solo se muestran si la empresa los cargó y el equipo aprobó el material.",
        "En la ficha pública de una empresa aparecen su banner, su logo y su material de presentación (video y fotos).\n\n"
        "Si no ves nada es porque esa empresa aún no lo ha cargado, o porque el material está pendiente de revisión: solo se muestra públicamente lo aprobado.\n\n"
        "Si eres la empresa y lo cargaste pero no aparece, comprueba que guardaste los cambios del perfil; hay un aviso en pantalla cuando queda algo sin guardar.",
        TODOS,
        1,
    ),
    (
        "Cuándo puedo dejar una reseña",
        "Cuando la orden esté entregada. Una reseña por orden.",
        "Las reseñas se dejan sobre órdenes ya entregadas, y solo una por orden: así la nota refleja tratos reales y no opiniones repetidas.\n\n"
        "Puntúas de 1 a 5 y puedes desglosar puntualidad, calidad y comunicación. La empresa tiene derecho a réplica pública.\n\n"
        "El equipo de ImportacionesQ8 puede ocultar una reseña que incumpla las normas, pero nunca la borra ni la edita.",
        CLIENTE,
        2,
    ),
    (
        "Qué información dar al abrir un ticket",
        "Qué intentabas hacer, qué viste exactamente y desde qué pantalla. Si hay un código, inclúyelo.",
        "Cuanto más concreto, más rápido se resuelve. Lo que de verdad ayuda:\n\n"
        "• **Qué intentabas hacer**: «confirmar la propuesta de la cotización COT-1A2B».\n"
        "• **Qué viste**: el mensaje de error **completo**, copiado tal cual. Muchos mensajes ya dicen la causa.\n"
        "• **Dónde**: la pantalla o la dirección del navegador.\n"
        "• **Códigos**: de cotización (COT-…) o de orden (ORD-…).\n"
        "• **Desde cuándo** y si te pasa siempre o una vez.\n\n"
        "Con eso, soporte reproduce el caso sin tener que preguntarte tres veces.",
        TODOS,
        3,
    ),
    ],
}


def main() -> None:
    db = SessionLocal()
    creados = 0
    actualizados = 0
    try:
        for categoria, articulos in ARTICULOS_POR_CATEGORIA.items():
            for titulo, resumen, contenido, roles, orden in articulos:
                existente = db.query(ArticuloAyuda).filter(ArticuloAyuda.titulo == titulo).first()
                if existente:
                    existente.resumen = resumen
                    existente.contenido = contenido
                    existente.categoria = categoria
                    existente.roles = list(roles)
                    existente.orden = orden
                    actualizados += 1
                    continue

                db.add(ArticuloAyuda(
                    id=str(uuid4()),
                    titulo=titulo,
                    resumen=resumen,
                    contenido=contenido,
                    categoria=categoria,
                    roles=list(roles),
                    orden=orden,
                    publicado=True,
                ))
                creados += 1

        db.commit()
        total = db.query(ArticuloAyuda).count()
        print(f"artículos creados: {creados} · actualizados: {actualizados} · total en la base: {total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
