# Catálogo completo de endpoints

Total: **201** operaciones REST exportadas desde OpenAPI (generado el 2026-10-01 con `scripts/generate_frontend_api_docs.py`). El WebSocket `/ws/chat/{conversacion_id}` no aparece en OpenAPI: ver [[08-Chat-y-WebSocket]].

| Método | Ruta | Tag | Auth | Resumen |
|--------|------|-----|------|---------|
| `GET` | `/` | Salud | Público | Root |
| `GET` | `/admin/backup` | Administración | JWT | Descargar Backup |
| `GET` | `/admin/backup/previos` | Administración | JWT | Listar Backups Previos |
| `GET` | `/admin/backup/previos/{nombre}` | Administración | JWT | Descargar Backup Previo |
| `POST` | `/admin/backup/previos/{nombre}/preparar` | Administración | JWT | Preparar Backup Previo |
| `POST` | `/admin/backup/restaurar/validar` | Administración | JWT | Validar Backup Subido |
| `DELETE` | `/admin/backup/restaurar/{subida_id}` | Administración | JWT | Descartar Backup Subido |
| `POST` | `/admin/backup/restaurar/{subida_id}` | Administración | JWT | Aplicar Backup Subido |
| `GET` | `/admin/backup/resumen` | Administración | JWT | Resumen Backup |
| `GET` | `/admin/certificaciones` | Administración | JWT | Listar Certificaciones Admin |
| `POST` | `/admin/certificaciones` | Administración | JWT | Crear Certificacion |
| `DELETE` | `/admin/certificaciones/{certificacion_id}` | Administración | JWT | Retirar Certificacion |
| `PUT` | `/admin/certificaciones/{certificacion_id}` | Administración | JWT | Actualizar Certificacion |
| `GET` | `/admin/conversaciones` | Administración | JWT | Listar Conversaciones Admin |
| `GET` | `/admin/conversaciones/{conversacion_id}/mensajes` | Administración | JWT | Leer Conversacion Admin |
| `POST` | `/admin/conversaciones/{conversacion_id}/mensajes` | Administración | JWT | Responder Conversacion Admin |
| `POST` | `/admin/correos/masivo` | Administración | JWT | Enviar Correo Masivo Admin |
| `GET` | `/admin/cotizaciones-abiertas` | Administración | JWT | Listar Cotizaciones Abiertas |
| `GET` | `/admin/cotizantes` | Administración | JWT | Listar Cotizantes Admin |
| `POST` | `/admin/cotizantes/recalcular-tiers` | Administración | JWT | Recalcular Tiers Cotizantes |
| `GET` | `/admin/cotizantes/tier-umbrales` | Administración | JWT | Listar Umbrales Tier |
| `PUT` | `/admin/cotizantes/tier-umbrales` | Administración | JWT | Actualizar Umbrales Tier |
| `POST` | `/admin/cotizantes/{usuario_id}/puntos` | Administración | JWT | Ajustar Puntos Cotizante |
| `GET` | `/admin/cotizantes/{usuario_id}/puntos/movimientos` | Administración | JWT | Listar Movimientos Puntos Cotizante |
| `DELETE` | `/admin/cotizantes/{usuario_id}/tier` | Administración | JWT | Liberar Tier Manual Cotizante |
| `PUT` | `/admin/cotizantes/{usuario_id}/tier` | Administración | JWT | Actualizar Tier Cotizante |
| `GET` | `/admin/disputas` | Administración | JWT | Listar Disputas |
| `PUT` | `/admin/disputas-room/{disputa_id}/resolver` | Administración | JWT | Resolver Disputa Por Id |
| `PUT` | `/admin/disputas/{orden_id}/resolver` | Administración | JWT | Resolver Disputa |
| `GET` | `/admin/equipo-soporte` | Administración | JWT | Listar Equipo Soporte |
| `POST` | `/admin/equipo-soporte` | Administración | JWT | Crear Agente Soporte |
| `PUT` | `/admin/equipo-soporte/{usuario_id}/nivel` | Administración | JWT | Cambiar Nivel Agente |
| `PUT` | `/admin/evidencias/{evidencia_id}/revisar` | Administración | JWT | Revisar Evidencia Importador |
| `POST` | `/admin/importadores` | Administración | JWT | Crear Importador Con Dueño |
| `GET` | `/admin/importadores/{importador_id}/certificaciones` | Administración | JWT | Listar Certificaciones De Empresa |
| `POST` | `/admin/importadores/{importador_id}/certificaciones` | Administración | JWT | Otorgar Certificacion |
| `DELETE` | `/admin/importadores/{importador_id}/certificaciones/{certificacion_id}` | Administración | JWT | Revocar Certificacion |
| `PUT` | `/admin/importadores/{importador_id}/estado` | Administración | JWT | Actualizar Estado Importador |
| `GET` | `/admin/importadores/{importador_id}/expediente` | Administración | JWT | Expediente Verificacion |
| `POST` | `/admin/importadores/{importador_id}/retirar-verificacion` | Administración | JWT | Retirar Verificacion Importador |
| `POST` | `/admin/importadores/{importador_id}/verificar` | Administración | JWT | Verificar Importador |
| `GET` | `/admin/metricas` | Administración | JWT | Obtener Metricas |
| `GET` | `/admin/recreaciones` | Administración | JWT | Listar Recreaciones |
| `PUT` | `/admin/recreaciones/{solicitud_id}/resolver` | Administración | JWT | Resolver Recreacion |
| `GET` | `/admin/usuarios` | Administración | JWT | Listar Usuarios |
| `PUT` | `/admin/usuarios/{usuario_id}/estado` | Administración | JWT | Actualizar Estado Usuario |
| `GET` | `/asesores/dashboard/stats` | Asesores | JWT | Dashboard Stats Asesor |
| `GET` | `/asesores/me/cotizaciones` | Asesores | JWT | Listar Mis Cotizaciones Asignadas |
| `POST` | `/auth/forgot-password` | Autenticación | Público | Olvido Password |
| `POST` | `/auth/login` | Autenticación | Público | Iniciar Sesion |
| `POST` | `/auth/login/verificar-otp` | Autenticación | Público | Confirmar Login Otp |
| `POST` | `/auth/logout` | Autenticación | JWT | Cerrar Sesion |
| `POST` | `/auth/reenviar-otp` | Autenticación | Público | Reenviar Codigo |
| `POST` | `/auth/refresh` | Autenticación | JWT | Renovar Token |
| `POST` | `/auth/register` | Autenticación | Público | Registrar Usuario |
| `POST` | `/auth/reset-password` | Autenticación | Público | Restablecer Password |
| `POST` | `/auth/verificar-email` | Autenticación | Público | Verificar Correo |
| `GET` | `/ayuda/articulos` | Ayuda y soporte | JWT | Listar Articulos |
| `POST` | `/ayuda/articulos` | Ayuda y soporte | JWT | Crear Articulo |
| `DELETE` | `/ayuda/articulos/{articulo_id}` | Ayuda y soporte | JWT | Despublicar Articulo |
| `PUT` | `/ayuda/articulos/{articulo_id}` | Ayuda y soporte | JWT | Editar Articulo |
| `POST` | `/ayuda/articulos/{articulo_id}/visto` | Ayuda y soporte | JWT | Marcar Visto |
| `POST` | `/ayuda/articulos/{articulo_id}/voto` | Ayuda y soporte | JWT | Votar Articulo |
| `GET` | `/ayuda/categorias` | Ayuda y soporte | JWT | Listar Categorias |
| `POST` | `/chat/calculadora/calcular` | Chat | JWT | Calcular Estimacion Precio |
| `GET` | `/chat/conversaciones` | Chat | JWT | Listar Mis Conversaciones |
| `POST` | `/chat/conversaciones/{conversacion_id}/estimaciones` | Chat | JWT | Enviar Estimacion Precio |
| `POST` | `/chat/conversaciones/{conversacion_id}/leida` | Chat | JWT | Marcar Conversacion Leida |
| `GET` | `/chat/conversaciones/{conversacion_id}/mensajes` | Chat | JWT | Listar Mensajes |
| `POST` | `/chat/conversaciones/{conversacion_id}/mensajes` | Chat | JWT | Enviar Mensaje |
| `POST` | `/chat/iniciar` | Chat | JWT | Iniciar Chat |
| `POST` | `/chat/interno` | Chat | JWT | Iniciar Chat Interno |
| `POST` | `/chat/mensajes/{mensaje_id}/traducir` | Chat | JWT | Traducir Mensaje |
| `POST` | `/chat/soporte` | Chat | JWT | Abrir Ticket Soporte |
| `POST` | `/chat/soporte/{conversacion_id}/calificar` | Chat | JWT | Calificar Soporte |
| `POST` | `/chat/soporte/{conversacion_id}/cerrar` | Chat | JWT | Cerrar Ticket Soporte |
| `POST` | `/chat/soporte/{conversacion_id}/escalar` | Chat | JWT | Escalar Ticket Soporte |
| `POST` | `/chat/soporte/{conversacion_id}/reabrir` | Chat | JWT | Reabrir Ticket Soporte |
| `POST` | `/chat/traducir` | Chat | JWT | Traducir Preview |
| `POST` | `/chat/ws-ticket` | Chat | JWT | Emitir Ticket Ws |
| `GET` | `/configuracion-publica` | Salud | Público | Configuracion Publica |
| `GET` | `/cotizaciones` | Cotizaciones | JWT | Listar Cotizaciones |
| `POST` | `/cotizaciones` | Cotizaciones | JWT | Crear Cotizacion |
| `GET` | `/cotizaciones/pool-empresa` | Cotizaciones | JWT | Listar Pool Empresa |
| `GET` | `/cotizaciones/{cotizacion_id}` | Cotizaciones | JWT | Obtener Cotizacion |
| `POST` | `/cotizaciones/{cotizacion_id}/desbloquear` | Cotizaciones | JWT | Desbloquear Cotizacion Por Punto |
| `GET` | `/cotizaciones/{cotizacion_id}/matching-status` | Cotizaciones | JWT | Obtener Estado Matching |
| `GET` | `/cotizaciones/{cotizacion_id}/propuestas` | Cotizaciones | JWT | Listar Propuestas |
| `PUT` | `/cotizaciones/{cotizacion_id}/propuestas/aceptar` | Cotizaciones | JWT | Aceptar Propuesta |
| `POST` | `/cotizaciones/{cotizacion_id}/reclamar` | Cotizaciones | JWT | Reclamar Cotizacion |
| `POST` | `/cotizaciones/{cotizacion_id}/solicitar-recreacion` | Cotizaciones | JWT | Solicitar Recreacion |
| `GET` | `/cotizantes/{solicitante_id}/perfil-publico` | Cotizantes | JWT | Obtener Perfil Publico |
| `POST` | `/creditos/comprar` | Créditos | JWT | Comprar Creditos |
| `GET` | `/creditos/movimientos` | Créditos | JWT | Listar Movimientos |
| `GET` | `/creditos/saldo` | Créditos | JWT | Obtener Saldo |
| `GET` | `/cursos` | Cursos | Público | Listar Cursos |
| `POST` | `/cursos` | Cursos | JWT | Crear Curso |
| `DELETE` | `/cursos/{curso_id}` | Cursos | JWT | Eliminar Curso |
| `PUT` | `/cursos/{curso_id}` | Cursos | JWT | Actualizar Curso |
| `GET` | `/cursos/{curso_id}/certificado` | Cursos | JWT | Obtener Certificado Curso |
| `POST` | `/cursos/{curso_id}/comprar` | Cursos | JWT | Comprar Curso |
| `POST` | `/cursos/{curso_id}/lecciones/{leccion_id}/progreso` | Cursos | JWT | Marcar Progreso Leccion |
| `GET` | `/cursos/{id_o_slug}` | Cursos | JWT | Obtener Curso |
| `GET` | `/disputas/orden/{orden_id}` | Disputas | JWT | Disputa Por Orden |
| `GET` | `/disputas/{disputa_id}` | Disputas | JWT | Obtener Disputa |
| `POST` | `/disputas/{disputa_id}/evidencias` | Disputas | JWT | Subir Evidencia Disputa |
| `POST` | `/disputas/{disputa_id}/mensajes` | Disputas | JWT | Mensaje Disputa |
| `POST` | `/documentos/archivos` | Gestión Documental | JWT | Crear Archivo |
| `POST` | `/documentos/archivos/upload` | Gestión Documental | JWT | Subir Archivo |
| `DELETE` | `/documentos/archivos/{archivo_id}` | Gestión Documental | JWT | Eliminar Archivo |
| `PATCH` | `/documentos/archivos/{archivo_id}` | Gestión Documental | JWT | Actualizar Archivo |
| `GET` | `/documentos/archivos/{archivo_id}/descargar` | Gestión Documental | JWT | Descargar Archivo |
| `PUT` | `/documentos/archivos/{archivo_id}/etiquetas` | Gestión Documental | JWT | Asignar Etiquetas Archivo |
| `GET` | `/documentos/buscar` | Gestión Documental | JWT | Buscar Archivos |
| `POST` | `/documentos/carpetas` | Gestión Documental | JWT | Crear Carpeta |
| `DELETE` | `/documentos/carpetas/{carpeta_id}` | Gestión Documental | JWT | Eliminar Carpeta |
| `PATCH` | `/documentos/carpetas/{carpeta_id}` | Gestión Documental | JWT | Actualizar Carpeta |
| `GET` | `/documentos/chats/{conversacion_id}/adjuntos` | Gestión Documental | JWT | Listar Adjuntos Chat |
| `POST` | `/documentos/compartir-chat` | Gestión Documental | JWT | Compartir Recursos Chat |
| `POST` | `/documentos/etiquetas` | Gestión Documental | JWT | Crear Etiqueta |
| `GET` | `/documentos/explorador` | Gestión Documental | JWT | Listar Explorador |
| `PUT` | `/documentos/favoritos` | Gestión Documental | JWT | Toggle Favorito |
| `GET` | `/health` | Salud | Público | Health Check |
| `GET` | `/health/ready` | Salud | Público | Readiness Check |
| `GET` | `/importadores` | Importadores | Público | Listar Importadores |
| `GET` | `/importadores/asesores` | Importadores | JWT | Listar Asesores |
| `POST` | `/importadores/asesores` | Importadores | JWT | Crear Asesor |
| `DELETE` | `/importadores/asesores/{asesor_id}` | Importadores | JWT | Eliminar Asesor |
| `PUT` | `/importadores/asesores/{asesor_id}/estado` | Importadores | JWT | Actualizar Estado Asesor |
| `GET` | `/importadores/campos-personalizados` | Importadores | JWT | Listar Mis Campos Personalizados |
| `POST` | `/importadores/campos-personalizados` | Importadores | JWT | Crear Campo Personalizado |
| `DELETE` | `/importadores/campos-personalizados/{campo_id}` | Importadores | JWT | Eliminar Campo Personalizado |
| `PUT` | `/importadores/campos-personalizados/{campo_id}` | Importadores | JWT | Actualizar Campo Personalizado |
| `GET` | `/importadores/certificados` | Importadores | Público | Listar Importadores Certificados |
| `PUT` | `/importadores/cotizaciones/{cotizacion_id}/asignar` | Importadores | JWT | Asignar Asesor A Cotizacion |
| `GET` | `/importadores/cupo-diario` | Importadores | JWT | Cupo Diario Importador |
| `GET` | `/importadores/destacados` | Importadores | Público | Listar Importadores Destacados |
| `GET` | `/importadores/evidencias` | Importadores | JWT | Listar Mis Evidencias |
| `POST` | `/importadores/evidencias` | Importadores | JWT | Crear Evidencia |
| `DELETE` | `/importadores/evidencias/{evidencia_id}` | Importadores | JWT | Eliminar Evidencia |
| `GET` | `/importadores/metricas` | Importadores | JWT | Metricas Importador |
| `GET` | `/importadores/por-categoria` | Importadores | Público | Listar Importadores Por Categoria |
| `GET` | `/importadores/{importador_id}` | Importadores | Público | Obtener Importador |
| `PUT` | `/importadores/{importador_id}` | Importadores | JWT | Actualizar Perfil Importador |
| `GET` | `/importadores/{importador_id}/evidencias` | Importadores | Público | Listar Evidencias Aprobadas Publicas |
| `GET` | `/importadores/{importador_id}/formulario` | Importadores | Público | Obtener Formulario Importador |
| `GET` | `/importadores/{importador_id}/ordenes-activas` | Importadores | JWT | Listar Ordenes Activas Importador |
| `GET` | `/importadores/{importador_id}/solicitudes-abiertas` | Importadores | JWT | Listar Solicitudes Abiertas |
| `GET` | `/importadores/{importador_id}/solicitudes-dirigidas` | Importadores | JWT | Listar Solicitudes Dirigidas |
| `GET` | `/landing/allies` | Landing CMS | JWT | Listar Aliados |
| `POST` | `/landing/allies` | Landing CMS | JWT | Crear Aliado |
| `DELETE` | `/landing/allies/{aliado_id}` | Landing CMS | JWT | Eliminar Aliado |
| `PUT` | `/landing/allies/{aliado_id}` | Landing CMS | JWT | Editar Aliado |
| `POST` | `/landing/contacto` | Landing CMS | Público | Enviar Contacto |
| `GET` | `/landing/dynamic-content` | Landing CMS | Público | Obtener Contenido Dinamico |
| `PUT` | `/landing/dynamic-content` | Landing CMS | JWT | Guardar Bloques |
| `GET` | `/landing/dynamic-content/admin` | Landing CMS | JWT | Obtener Contenido Dinamico Admin |
| `GET` | `/landing/news` | Landing CMS | JWT | Listar Noticias |
| `POST` | `/landing/news` | Landing CMS | JWT | Crear Noticia |
| `DELETE` | `/landing/news/{noticia_id}` | Landing CMS | JWT | Eliminar Noticia |
| `PUT` | `/landing/news/{noticia_id}` | Landing CMS | JWT | Editar Noticia |
| `GET` | `/legal/politica-tratamiento-datos` | Legal | Público | Politica Tratamiento Datos |
| `GET` | `/legal/terminos-condiciones` | Legal | Público | Terminos Condiciones |
| `GET` | `/mis-cursos` | Cursos | JWT | Mis Cursos |
| `GET` | `/notificaciones` | Notificaciones | JWT | Listar Notificaciones |
| `PUT` | `/notificaciones/leer-todas` | Notificaciones | JWT | Marcar Todas Leidas |
| `GET` | `/notificaciones/stream` | Notificaciones | JWT | Stream Notificaciones |
| `POST` | `/notificaciones/stream-ticket` | Notificaciones | JWT | Emitir Ticket Stream |
| `PUT` | `/notificaciones/{notificacion_id}/leer` | Notificaciones | JWT | Marcar Leida |
| `PATCH` | `/notificaciones/{notificacion_id}/leida` | Notificaciones | JWT | Actualizar Leida |
| `GET` | `/ordenes` | Órdenes | JWT | Listar Ordenes |
| `GET` | `/ordenes/cotizacion/{cotizacion_id}` | Órdenes | JWT | Obtener Orden Por Cotizacion |
| `GET` | `/ordenes/importador/{importador_id}/activas` | Órdenes | JWT | Listar Ordenes Activas Importador |
| `GET` | `/ordenes/{orden_id}` | Órdenes | JWT | Obtener Orden |
| `POST` | `/ordenes/{orden_id}/documentos` | Órdenes | JWT | Agregar Documento Orden |
| `PUT` | `/ordenes/{orden_id}/estado` | Órdenes | JWT | Actualizar Estado Orden |
| `PUT` | `/ordenes/{orden_id}/reportar-problema` | Órdenes | JWT | Reportar Problema Orden |
| `GET` | `/organizaciones/me` | Organizaciones solicitantes | JWT | Mi Organizacion |
| `POST` | `/organizaciones/me/invitar` | Organizaciones solicitantes | JWT | Invitar Miembro |
| `GET` | `/organizaciones/me/miembros` | Organizaciones solicitantes | JWT | Listar Miembros |
| `PUT` | `/organizaciones/me/miembros/{miembro_id}` | Organizaciones solicitantes | JWT | Actualizar Miembro |
| `POST` | `/pagos/webhook/wompi` | Pagos | Público | Webhook Wompi |
| `GET` | `/pagos/{pago_id}` | Pagos | JWT | Obtener Pago |
| `POST` | `/propuestas` | Propuestas | JWT | Enviar Propuesta |
| `POST` | `/propuestas/borrador` | Propuestas | JWT | Crear Borrador Propuesta |
| `PUT` | `/propuestas/{propuesta_id}` | Propuestas | JWT | Editar Propuesta |
| `POST` | `/propuestas/{propuesta_id}/enviar` | Propuestas | JWT | Enviar Borrador Propuesta |
| `POST` | `/propuestas/{propuesta_id}/pre-aceptar` | Propuestas | JWT | Pre Aceptar Propuesta |
| `GET` | `/referidos/estadisticas` | Referidos | JWT | Estadisticas |
| `GET` | `/referidos/mi-codigo` | Referidos | JWT | Mi Codigo |
| `POST` | `/resenas` | Reseñas | JWT | Crear Resena |
| `GET` | `/resenas/importador/{importador_id}` | Reseñas | Público | Listar Resenas De Importador |
| `GET` | `/resenas/importador/{importador_id}/resumen` | Reseñas | Público | Resumen De Importador |
| `GET` | `/resenas/mias` | Reseñas | JWT | Mis Resenas |
| `GET` | `/resenas/pendientes` | Reseñas | JWT | Ordenes Pendientes De Resena |
| `PUT` | `/resenas/{resena_id}` | Reseñas | JWT | Editar Resena |
| `PUT` | `/resenas/{resena_id}/moderar` | Reseñas | JWT | Moderar Resena |
| `POST` | `/resenas/{resena_id}/responder` | Reseñas | JWT | Responder Resena |
| `GET` | `/usuarios/me` | Usuarios | JWT | Obtener Mi Perfil |
| `PUT` | `/usuarios/me` | Usuarios | JWT | Actualizar Mi Perfil |
| `GET` | `/usuarios/{solicitante_id}/perfil-publico` | Usuarios | JWT | Obtener Perfil Publico Cotizante |

## Colección HTTP

- Postman/Insomnia: [[14-Postman-Insomnia]]
- Archivo: `Zarpi.postman_collection.json` (en `02-Integracion-API/`)
- Índice de la carpeta: [[Indice-Integracion-API]]

## Índice por módulo

- [[02-Auth|APIs — Autenticación]]
- [[03-Usuarios-Asesores-y-Perfil|APIs — Usuarios, asesores y perfil]]
- [[04-Importadores|APIs — Importadores]]
- [[05-Cotizaciones-y-Propuestas|APIs — Cotizaciones y propuestas]]
- [[06-Ordenes|APIs — Órdenes]]
- [[07-Creditos-y-Pagos|APIs — Créditos y pagos]]
- [[08-Chat-y-WebSocket|APIs — Chat y WebSocket]]
- [[09-Organizaciones|APIs — Organizaciones solicitantes]]
- [[10-Disputas|APIs — Disputas]]
- [[11-Referidos|APIs — Referidos]]
- [[12-Admin|APIs — Administración]]
- [[13-Legal-y-Salud|APIs — Legal y salud]]
- [[21-Ayuda-y-Soporte|APIs — Centro de ayuda]]
- [[22-Landing-CMS|APIs — Landing (CMS por bloques)]]
- [[15-Cursos-LMS|APIs — Cursos / LMS]]
- [[16-Notificaciones|APIs — Notificaciones in-app]]
- [[17-Documentos-y-Multimedia|APIs — Gestión documental y multimedia]]
