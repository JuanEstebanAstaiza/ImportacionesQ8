# APIs — Tipografía de la plataforma y videos de «Quiénes somos»

> Backend: `services/tipografia.py`, `routers/tipografia.py`, `routers/landing.py` (videos), `schemas/landing.py`.
> Frontend: **Admin › Tipografía** (`features/admin/TipografiaPlataforma.tsx`), **Admin › Landing** (`features/admin/LandingCmsEditor.tsx`), `services/tipografia.service.ts`, `app/components/media/CarruselVideos.tsx`.
> Desde el 2026-10-07.

## Tipografía

### Catálogo: Fontsource

Se usa la API pública de [Fontsource](https://fontsource.org/docs/api) (`api.fontsource.org/v1/fonts`), que reúne Google Fonts y otras fuentes de código abierto:

- No pide clave de API (la de Google Fonts sí).
- Todas sus fuentes tienen licencias que permiten alojarlas en servidor propio. Se aceptan OFL-1.1, Apache-2.0, UFL-1.0, CC0-1.0, MIT y Unlicense.
- Se ofrecen las que tienen alfabeto latino y peso 400, sin la categoría de iconos (unas 2.050).
- El catálogo se cachea un día en memoria.
- Límite de la API: 2.500 peticiones cada 10 segundos. El panel hace muy pocas.
- La API rechaza (403) peticiones sin `User-Agent`; el backend se identifica como `Zarpi/1.0`.

### Cómo funciona

1. El admin busca y previsualiza. La vista previa (`GET /admin/tipografia/vista-previa/{id}?peso=`) pasa por el backend, que guarda el WOFF2 en `uploads/fuentes/_previas/`. El navegador del admin no se conecta al CDN externo.
2. Al aplicar (`PUT /admin/tipografia {texto_id, titulos_id}`), el backend descarga una sola vez los WOFF2 de la fuente:
   - latín y latín extendido;
   - grosores 300 a 800;
   - cursivas 400 y 700.

   Los guarda en `uploads/fuentes/{id}/` (volumen persistente `backend_uploads`) con un `manifiesto.json`.
3. `GET /tipografia/activa.css` (público) devuelve los `@font-face` apuntando a `/tipografia/archivos/{id}/...` y sobrescribe las variables de `theme.css` (`--font-sans`, `--font-display`, `--font-avenor`, `--font-elvellon`). `main.tsx` la carga al iniciar.
4. Desde ahí, ningún visitante se conecta a Fontsource ni a jsDelivr: las fuentes salen del servidor de Zarpi.

`texto_id` vacío vuelve a la tipografía de marca (Elvellon para títulos y AT Avenor para texto). `titulos_id` vacío usa la fuente del texto también para títulos.

**Bloques de la landing.** Cada bloque de texto guarda `fuente`:
- `titulos` o `texto`: siguen a la tipografía de la plataforma. Usan las clases `.fuente-titulos` y `.fuente-texto`, que leen `--font-display` y `--font-avenor`.
- `elvellon` o `avenor`: las fuentes de marca, fijas.

Las fijas usan `.fuente-marca-*` y no las utilitarias `.font-elvellon`/`.font-avenor`, porque la hoja del gestor las pisa con `!important`. Antes las dos opciones del editor se veían iguales.

La landing pública y la vista previa del editor dibujan los bloques con el mismo componente (`features/landing/BloqueLanding.tsx`). Ese componente respeta el color elegido y los saltos de línea. Migración `20261009_0033`.

### Seguridad

- Solo se habla con `api.fontsource.org` y `cdn.jsdelivr.net/fontsource/`. Las URLs que devuelve la API se validan contra esa lista antes de descargar, para evitar SSRF.
- El id de la fuente se valida con `^[a-z0-9][a-z0-9-]{0,79}$` y los nombres de archivo con un patrón fijo. Ninguno de los dos llega crudo al disco.
- Cada archivo debe empezar con la firma `wOF2` y pesar como mucho 2 MB.
- El CSS usa alias fijos («Zarpi Texto» y «Zarpi Titulos»), no el nombre que trae la API.
- La instalación ocurre en una carpeta temporal y solo se mueve a su sitio si todo salió bien.

### Endpoints

| Método | Ruta | Acceso |
|--------|------|--------|
| GET | `/tipografia/activa.css` | Público |
| GET | `/tipografia/archivos/{id}/{archivo}.woff2` | Público |
| GET | `/admin/tipografia` | Admin |
| GET | `/admin/tipografia/catalogo?q=&categoria=&pagina=` | Admin |
| GET | `/admin/tipografia/vista-previa/{id}?peso=` | Admin |
| PUT | `/admin/tipografia` | Admin |

## Videos de «Quiénes somos»

Carrusel de hasta 10 videos, cada uno en versión horizontal (16:9), vertical (9:16) o ambas.

- **Guardado:** un único bloque `video_rotativo` de la sección `about`, con la configuración en JSON (`{intervalo_segundos, videos: [{id, titulo, horizontal, vertical}]}`). Se guarda con `PUT /landing/videos-quienes-somos`. «Guardar estructura» (`PUT /landing/dynamic-content`) no lo borra ni lo pisa.
- **Visitantes:** cada uno ve la versión de su pantalla. El carrusel pasa al siguiente video al cumplirse el intervalo (5 a 300 s) o cuando el video termina, lo que ocurra primero.
- **Reproducción:** arranca sin sonido y no rota con el puntero encima, con la pestaña oculta ni con «reducir movimiento».
- **Archivos públicos:** al estar el bloque activo, sus videos se sirven sin sesión por la regla de recursos de la Landing.
- **Vista previa en el editor:** se carga solo al pedirla. Antes, la vista previa se remontaba en cada render y volvía a descargar el video entero, lo que con archivos de más de 100 MB congelaba el editor e impedía guardar.
