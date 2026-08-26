# 17) Gestión Documental + Chat multimedia

Guía de integración para el módulo de documentos tipo Drive, adjuntos de chat y reglas de cursos vinculadas a archivos gestionados.

---

## Resumen funcional

- Explorador documental con carpetas y archivos por usuario.
- Soft delete de archivos/carpetas (no se eliminan físicamente).
- Tipos permitidos en backend:
  - Documentos: `pdf`, `doc`, `docx`, `pptx`, `xls`, `xlsx`, `txt`
  - Imágenes: `png`, `jpg`, `jpeg`, `webp`
  - Video: `mp4`
- Compartir archivos en chats existentes.
- Panel lateral de adjuntos por conversación.
- Bloqueo de eliminación de archivo si está vinculado a curso activo.

---

## Endpoints de Gestión Documental

Base: `/documentos`

### 1) Explorador

- Método: `GET`
- Ruta: `/documentos/explorador`
- Query opcional: `parent_id`
- Respuesta: `{ carpetas: CarpetaItem[], archivos: ArchivoItem[] }`

Ejemplo:

```bash
curl -X GET "http://localhost:8000/documentos/explorador?parent_id=<UUID>" \
  -H "Authorization: Bearer <token>"
```

### 2) Crear carpeta

- Método: `POST`
- Ruta: `/documentos/carpetas`
- Body:

```json
{
  "nombre": "Facturas 2026",
  "parent_id": null
}
```

### 3) Actualizar carpeta

- Método: `PATCH`
- Ruta: `/documentos/carpetas/{carpeta_id}`

### 4) Eliminar carpeta (soft delete)

- Método: `DELETE`
- Ruta: `/documentos/carpetas/{carpeta_id}`

### 5) Crear archivo (registro metadata)

- Método: `POST`
- Ruta: `/documentos/archivos`
- Body:

```json
{
  "nombre": "cotizacion-q8.pdf",
  "extension": "pdf",
  "mime_type": "application/pdf",
  "size_bytes": 2048,
  "storage_url": "https://cdn.ejemplo.com/cotizacion-q8.pdf",
  "origen": "manual",
  "carpeta_id": null
}
```

### 6) Actualizar archivo

- Método: `PATCH`
- Ruta: `/documentos/archivos/{archivo_id}`

### 7) Eliminar archivo (soft delete)

- Método: `DELETE`
- Ruta: `/documentos/archivos/{archivo_id}`

Regla crítica:
- Si el archivo está vinculado a un curso activo (publicado o borrador), backend responde `409`.

### 8) Buscar archivos

- Método: `GET`
- Ruta: `/documentos/buscar`
- Query soportadas:
  - `q`
  - `tipo_recurso`
  - `favorito`
  - `etiqueta_ids`
  - `fecha_desde`
  - `fecha_hasta`

### 9) Favoritos

- Método: `POST`
- Ruta: `/documentos/favoritos/toggle`

### 10) Etiquetas

- Método: `POST`
- Ruta: `/documentos/etiquetas`
- Método: `GET`
- Ruta: `/documentos/etiquetas`
- Método: `POST`
- Ruta: `/documentos/archivos/{archivo_id}/etiquetas`

### 11) Descargar archivo

- Método: `GET`
- Ruta: `/documentos/archivos/{archivo_id}/descargar`

---

## Chat multimedia (integración REST)

### Compartir archivos a chat

- Método: `POST`
- Ruta: `/documentos/compartir-chat`
- Body:

```json
{
  "conversacion_ids": ["<UUID>"],
  "archivo_ids": ["<UUID_ARCHIVO>"],
  "mensaje": "Adjunto cotización y anexo técnico"
}
```

Respuesta:

```json
{
  "success": true,
  "mensajes_creados": 1
}
```

### Listar adjuntos por conversación

- Método: `GET`
- Ruta: `/documentos/chats/{conversacion_id}/adjuntos`
- Respuesta: `ChatAttachmentItem[]`

---

## Cursos: reglas nuevas aplicadas

- No se aceptan enlaces de YouTube en:
  - `video_url` de lección
  - `url` de recursos de lección
- Endpoints de curso para ciclo de vida:
  - `PUT /cursos/{curso_id}`
  - `DELETE /cursos/{curso_id}` (soft delete)
- `DELETE` marca `deleted_at` y archiva estado.

---

## PDFs automáticos en órdenes

Cuando una propuesta llega a doble aceptación y se genera orden:

- Backend genera PDFs automáticos de:
  - Cotización
  - Propuesta
  - Orden
- Se registran en:
  - `archivos`
  - `orden_documentos`
  - y compatibilidad en tabla legacy `documentos_orden`

Esto habilita trazabilidad documental y descarga desde módulo de órdenes.

---

## Notas de frontend

- Para adjuntar en chat:
  1. Registrar archivo en `/documentos/archivos`
  2. Compartir en `/documentos/compartir-chat`
  3. Refrescar mensajes y `/documentos/chats/{id}/adjuntos`
- Para vista documentos:
  - Cargar explorador en `/documentos/explorador`
  - Mantener búsqueda con `/documentos/buscar`

---

## Normalización de URLs de recursos

Los routers del backend se montan en la raíz (`/documentos`, `/cursos`, ...).
El prefijo `/api` **no existe en FastAPI**: lo agrega el proxy del dev server de
Vite (`server.proxy` en `vite.config.ts`) y lo elimina antes de reenviar.

Reglas:

- `storage_url` de un archivo propio se guarda como ruta canónica del backend:
  `/documentos/archivos/{id}/descargar`. Nunca con host ni con `/api`.
- Un recurso realmente externo (CDN, almacenamiento remoto) se guarda como URL
  absoluta http(s) y se conserva intacta.
- Al leer, el cliente resuelve la ruta contra el backend alcanzable desde ese
  browser (`resolveApiUrl` en `services/api-client.ts`). Eso absorbe lo que ya
  está guardado en formas viejas: `/api/...`, `/api/api/...`,
  `http://localhost:5173/api/...` o `http://localhost:8000/...`.
- Al escribir, el cliente envía la forma canónica (`toApiPath`) y el backend la
  vuelve a canonicalizar (`utils/urls.py`), de modo que re-guardar un curso
  antiguo repara sus URLs.
- `VITE_API_URL` no debe incluir `/api`. Si apunta a loopback y la app se sirve
  desde un host remoto (Dev Tunnel, LAN), el cliente lo ignora y usa el proxy
  same-origin, que sí es alcanzable desde el browser del usuario.

---

## Estado de compatibilidad

- Compatible con autenticación JWT existente.
- Compatible con flujo actual de conversaciones y órdenes.
- Mantiene soporte de documentos legacy de orden en paralelo al nuevo esquema.
