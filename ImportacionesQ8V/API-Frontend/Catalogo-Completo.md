# Catálogo completo de endpoints

Total: **94** operaciones REST exportadas desde OpenAPI.

| Método | Ruta | Tag | Auth | Resumen |
|--------|------|-----|------|---------|
| `GET` | `/` | Salud | Público | Root |
| `GET` | `/admin/cotizaciones-abiertas` | Administración | JWT | Listar Cotizaciones Abiertas |
| `GET` | `/admin/disputas` | Administración | JWT | Listar Disputas |
| `PUT` | `/admin/disputas-room/{disputa_id}/resolver` | Administración | JWT | Resolver Disputa Por Id |
| `PUT` | `/admin/disputas/{orden_id}/resolver` | Administración | JWT | Resolver Disputa |
| `PUT` | `/admin/evidencias/{evidencia_id}/revisar` | Administración | JWT | Revisar Evidencia Importador |
| `POST` | `/admin/importadores` | Administración | JWT | Crear Importador Con Dueño |
| `PUT` | `/admin/importadores/{importador_id}/estado` | Administración | JWT | Actualizar Estado Importador |
| `POST` | `/admin/importadores/{importador_id}/verificar` | Administración | JWT | Verificar Importador |
| `GET` | `/admin/metricas` | Administración | JWT | Obtener Metricas |
| `GET` | `/admin/recreaciones` | Administración | JWT | Listar Recreaciones |
| `PUT` | `/admin/recreaciones/{solicitud_id}/resolver` | Administración | JWT | Resolver Recreacion |
| `GET` | `/admin/usuarios` | Administración | JWT | Listar Usuarios |
| `PUT` | `/admin/usuarios/{usuario_id}/estado` | Administración | JWT | Actualizar Estado Usuario |
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
| `GET` | `/chat/conversaciones` | Chat | JWT | Listar Mis Conversaciones |
| `GET` | `/chat/conversaciones/{conversacion_id}/mensajes` | Chat | JWT | Listar Mensajes |
| `POST` | `/chat/conversaciones/{conversacion_id}/mensajes` | Chat | JWT | Enviar Mensaje |
| `POST` | `/chat/mensajes/{mensaje_id}/traducir` | Chat | JWT | Traducir Mensaje |
| `POST` | `/chat/traducir` | Chat | JWT | Traducir Preview |
| `POST` | `/chat/ws-ticket` | Chat | JWT | Emitir Ticket Ws |
| `GET` | `/cotizaciones/` | Cotizaciones | JWT | Listar Cotizaciones |
| `POST` | `/cotizaciones/` | Cotizaciones | JWT | Crear Cotizacion |
| `GET` | `/cotizaciones/pool-empresa` | Cotizaciones | JWT | Listar Pool Empresa |
| `GET` | `/cotizaciones/{cotizacion_id}` | Cotizaciones | JWT | Obtener Cotizacion |
| `GET` | `/cotizaciones/{cotizacion_id}/matching-status` | Cotizaciones | JWT | Obtener Estado Matching |
| `GET` | `/cotizaciones/{cotizacion_id}/propuestas` | Cotizaciones | JWT | Listar Propuestas |
| `PUT` | `/cotizaciones/{cotizacion_id}/propuestas/aceptar` | Cotizaciones | JWT | Aceptar Propuesta |
| `POST` | `/cotizaciones/{cotizacion_id}/reclamar` | Cotizaciones | JWT | Reclamar Cotizacion |
| `POST` | `/cotizaciones/{cotizacion_id}/solicitar-recreacion` | Cotizaciones | JWT | Solicitar Recreacion |
| `POST` | `/creditos/comprar` | Créditos | JWT | Comprar Creditos |
| `GET` | `/creditos/movimientos` | Créditos | JWT | Listar Movimientos |
| `GET` | `/creditos/saldo` | Créditos | JWT | Obtener Saldo |
| `GET` | `/disputas/orden/{orden_id}` | Disputas | JWT | Disputa Por Orden |
| `GET` | `/disputas/{disputa_id}` | Disputas | JWT | Obtener Disputa |
| `POST` | `/disputas/{disputa_id}/evidencias` | Disputas | JWT | Subir Evidencia Disputa |
| `POST` | `/disputas/{disputa_id}/mensajes` | Disputas | JWT | Mensaje Disputa |
| `GET` | `/health` | Salud | Público | Health Check |
| `GET` | `/health/ready` | Salud | Público | Readiness Check |
| `GET` | `/importadores/` | Importadores | Público | Listar Importadores |
| `POST` | `/importadores/` | Importadores | JWT | Crear Importador |
| `GET` | `/importadores/asesores` | Importadores | JWT | Listar Asesores |
| `POST` | `/importadores/asesores` | Importadores | JWT | Crear Asesor |
| `PUT` | `/importadores/asesores/{asesor_id}/estado` | Importadores | JWT | Actualizar Estado Asesor |
| `GET` | `/importadores/campos-personalizados` | Importadores | JWT | Listar Mis Campos Personalizados |
| `POST` | `/importadores/campos-personalizados` | Importadores | JWT | Crear Campo Personalizado |
| `DELETE` | `/importadores/campos-personalizados/{campo_id}` | Importadores | JWT | Eliminar Campo Personalizado |
| `PUT` | `/importadores/campos-personalizados/{campo_id}` | Importadores | JWT | Actualizar Campo Personalizado |
| `GET` | `/importadores/certificados` | Importadores | Público | Listar Importadores Certificados |
| `GET` | `/importadores/destacados` | Importadores | Público | Listar Importadores Destacados |
| `GET` | `/importadores/evidencias` | Importadores | JWT | Listar Mis Evidencias |
| `POST` | `/importadores/evidencias` | Importadores | JWT | Crear Evidencia |
| `DELETE` | `/importadores/evidencias/{evidencia_id}` | Importadores | JWT | Eliminar Evidencia |
| `GET` | `/importadores/por-categoria` | Importadores | Público | Listar Importadores Por Categoria |
| `GET` | `/importadores/{importador_id}` | Importadores | Público | Obtener Importador |
| `PUT` | `/importadores/{importador_id}` | Importadores | JWT | Actualizar Perfil Importador |
| `GET` | `/importadores/{importador_id}/evidencias` | Importadores | Público | Listar Evidencias Aprobadas Publicas |
| `GET` | `/importadores/{importador_id}/formulario` | Importadores | Público | Obtener Formulario Importador |
| `GET` | `/importadores/{importador_id}/ordenes-activas` | Importadores | JWT | Listar Ordenes Activas Importador |
| `GET` | `/importadores/{importador_id}/solicitudes-abiertas` | Importadores | JWT | Listar Solicitudes Abiertas |
| `GET` | `/importadores/{importador_id}/solicitudes-dirigidas` | Importadores | JWT | Listar Solicitudes Dirigidas |
| `GET` | `/legal/politica-tratamiento-datos` | Legal | Público | Politica Tratamiento Datos |
| `GET` | `/legal/terminos-condiciones` | Legal | Público | Terminos Condiciones |
| `GET` | `/ordenes/` | Órdenes | JWT | Listar Ordenes |
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
| `POST` | `/propuestas/` | Propuestas | JWT | Enviar Propuesta |
| `POST` | `/propuestas/borrador` | Propuestas | JWT | Crear Borrador Propuesta |
| `PUT` | `/propuestas/{propuesta_id}` | Propuestas | JWT | Editar Propuesta |
| `POST` | `/propuestas/{propuesta_id}/enviar` | Propuestas | JWT | Enviar Borrador Propuesta |
| `POST` | `/propuestas/{propuesta_id}/pre-aceptar` | Propuestas | JWT | Pre Aceptar Propuesta |
| `GET` | `/referidos/estadisticas` | Referidos | JWT | Estadisticas |
| `GET` | `/referidos/mi-codigo` | Referidos | JWT | Mi Codigo |
| `GET` | `/usuarios/me` | Usuarios | JWT | Obtener Mi Perfil |
| `PUT` | `/usuarios/me` | Usuarios | JWT | Actualizar Mi Perfil |

## Colección HTTP

- Postman/Insomnia: [[14-Postman-Insomnia]]
- Archivo: `ImportacionesQ8.postman_collection.json` (en esta carpeta)

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
