# Academia — cursos de importadoras

Módulo para que **empresas importadoras** vendan cursos (importación, productos ganadores, etc.) y los **solicitantes** los compren y sigan su **progreso** por lección/video.

Base URL: `http://localhost:8000`  
Prefijo: `/academia`

---

## Roles

| Rol | Puede |
|-----|--------|
| `importador` / `asesor` | Crear/editar cursos y lecciones de **su** empresa; publicar |
| `solicitante` | Explorar catálogo, **comprar**, marcar lecciones completadas, ver progreso |
| Otros | Solo explorar catálogo autenticado (sin comprar) |

> **Solo el solicitante puede comprar.** Importadoras no compran cursos.

---

## Modelo de datos (resumen)

| Entidad | Descripción |
|---------|-------------|
| `Curso` | Título, descripción, categoría, `precio_usd`, estado (`borrador` / `publicado` / `archivado`) |
| `CursoLeccion` | Unidad de progreso (video/texto/recurso), `orden`, URL o texto |
| `CompraCurso` | Compra de un solicitante (única por curso+usuario) |
| `ProgresoLeccion` | Lección marcada como completada |

### Progreso

```text
progreso_pct = (lecciones_completadas / total_lecciones) * 100
```

Ejemplo: 10 videos, 8 completados → **80%**.

---

## Endpoints — gestión (importadora)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/academia/cursos` | Crear curso (borrador) |
| `GET` | `/academia/mis-cursos` | Cursos de mi empresa |
| `PUT` | `/academia/cursos/{id}` | Actualizar (título, precio, estado…) |
| `POST` | `/academia/cursos/{id}/publicar` | Publicar (exige ≥1 lección) |
| `POST` | `/academia/cursos/{id}/lecciones` | Añadir lección/video |
| `PUT` | `/academia/cursos/{id}/lecciones/{leccion_id}` | Editar lección |
| `DELETE` | `/academia/cursos/{id}/lecciones/{leccion_id}` | Eliminar lección |

### Body crear curso

```json
{
  "titulo": "Importación desde China 101",
  "descripcion": "Desde el sourcing hasta la nacionalización",
  "categoria": "importacion",
  "precio_usd": 49.99,
  "imagen_url": "https://cdn.example.com/portada.jpg"
}
```

### Body crear lección

```json
{
  "titulo": "Video 1 — Introducción",
  "tipo": "video",
  "contenido_url": "https://cdn.example.com/v1.mp4",
  "orden": 1,
  "duracion_segundos": 600
}
```

`tipo`: `video` | `texto` | `recurso`. Si omites `orden`, se asigna al final.

---

## Endpoints — catálogo y compra (solicitante)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/academia/catalogo?categoria=` | Cursos **publicados** |
| `GET` | `/academia/cursos/{id}` | Detalle + lecciones (contenido solo si compró o es dueño) |
| `POST` | `/academia/cursos/{id}/comprar` | Comprar (solo `solicitante`) |
| `GET` | `/academia/mis-compras` | Historial de compras |

### Compra

- Con `WOMPI_SIMULATE=true` (dev) o `precio_usd = 0` → compra **confirmada** al instante.
- En producción con precio > 0 y simulación activa → 503 (igual que otros pagos).
- Doble compra del mismo curso → **409**.

Sin compra, el detalle lista lecciones pero **oculta** `contenido_url` / `contenido_texto`.

---

## Endpoints — progreso (solicitante con compra)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/academia/cursos/{id}/progreso` | `%`, totales y lecciones con flag `completada` |
| `POST` | `/academia/cursos/{id}/lecciones/{leccion_id}/completar` | Marcar hecha → devuelve progreso actualizado |
| `DELETE` | `/academia/cursos/{id}/lecciones/{leccion_id}/completar` | Desmarcar |

### Ejemplo respuesta progreso (8/10)

```json
{
  "curso_id": "...",
  "total_lecciones": 10,
  "lecciones_completadas": 8,
  "progreso_pct": 80.0,
  "lecciones": [
    { "id": "...", "titulo": "Video 1", "orden": 1, "completada": true, "contenido_url": "..." },
    { "id": "...", "titulo": "Video 9", "orden": 9, "completada": false, "contenido_url": "..." }
  ]
}
```

Sin compra → **403**.

---

## Flujo recomendado (frontend)

### Importadora

1. `POST /academia/cursos`
2. Varios `POST .../lecciones` (videos 1…N)
3. `POST .../publicar`
4. `GET /academia/mis-cursos` en panel

### Solicitante

1. `GET /academia/catalogo`
2. `GET /academia/cursos/{id}` (preview)
3. `POST .../comprar`
4. Al terminar un video: `POST .../lecciones/{id}/completar`
5. Barra de progreso con `progreso_pct` de `GET .../progreso` o del detalle

---

## Migración

```text
alembic/versions/20260721_0005_academia.py
```

En Docker/local con `init_db` + Alembic se aplica al arrancar (o `alembic upgrade head`).

---

## Ver también

- [[Indice-Integracion-API]]
- [[00-Env-y-Arranque]] (`WOMPI_SIMULATE`)
- Código: `proyecto/backend/routers/academia.py`, `models/academia.py`
