# APIs — Tendencias semanales y catálogos de empresas

> Backend: `models/tendencias.py`, `models/catalogo.py`, `services/tendencias.py`, `services/tendencias_calculo.py`, `services/catalogos.py`, `services/origen_cotizacion.py`, `routers/tendencias.py`, `routers/catalogos.py`.
> Frontend: `features/tendencias/*` (comprador y panel del curador), `features/catalogos/*` (empresa y comprador), `services/tendencias.service.ts`, `services/catalogos.service.ts`.
> Especificación: `docs/Especificación Tendencias semanales.html`.
> Migración: `20261006_0028`. Desde el 2026-10-06.

## Qué es

- **Tendencias:** cada lunes el equipo de Zarpi publica una edición con hasta 6 productos en tendencia en China. Cada producto dice por qué está en tendencia, hasta qué fecha conviene pedirlo para que llegue a su temporada (por mar y por aéreo) y cómo venderlo. La única acción comercial es **pedir propuestas**, que abre una solicitud normal prellenada. **No hay precios** en ningún modelo ni pantalla.
- **Acceso privado.** A diferencia de la V1 de la especificación (que dejaba el muro de pago fuera de alcance), las ediciones solo las ve quien tiene un periodo de acceso vigente:
  - **pagado:** suscripción por un precio en COP y una duración que fija el admin; se cobra con Wompi;
  - **de cortesía:** el admin se lo regala a un usuario por X días.
  Sin acceso, el comprador solo ve la portada y cuántos productos trae la edición. El admin y los curadores siempre tienen acceso.
- **Catálogos de empresas:** cada empresa importadora arma catálogos selectos de productos que ofrece importar. Son **gratuitos** para el comprador; la empresa decide a quién se los desbloquea.

---

## Roles

| Quién | Puede |
|-------|-------|
| Comprador sin acceso | Ver la portada de la edición y suscribirse |
| Comprador con acceso | Ver la edición, fichas, calendario, archivo; guardar; suscribirse al aviso semanal; pedir propuestas |
| Curador (`usuarios.es_curador`) | Crear y editar ediciones y productos, vista previa, programar y publicar. Es una **capacidad**, no un rol: un usuario de soporte puede ser curador |
| Admin | Todo lo del curador, más retirar la edición publicada, asignar curadores, regalar o revocar accesos, fijar precio y duración, editar temporadas, cierres de fábricas y parámetros, ver la bitácora |
| Empresa (cuenta dueña) | Crear catálogos, productos y dar acceso a mano |
| Asesor | Ver los catálogos de su empresa (solo lectura) |

---

## Cálculo de la fecha ideal

`services/tendencias_calculo.py`, funciones puras con los cuatro casos de la especificación como pruebas (`tests/test_tendencias.py`).

```
fecha_en_bodega = la del producto, o (fecha de la temporada − 21 días)
limite          = fecha_en_bodega − días puerta a puerta (75 mar / 35 aéreo, o los del producto)
fin_produccion  = limite + días de producción (20)
si fin_produccion cae en un cierre de fábricas:
    limite = cierre.fin_produccion_previa − días de producción   (aviso_cierre_fabricas = true)
```

Estados para el comprador (contra hoy, en hora de Bogotá) y para el curador (contra la fecha de publicación): `todo_el_anio`, `pidelo_ya` (0–7 días), `ventana_abierta` (8–30), `futura` (>30), `solo_aereo`, `fuera_de_tiempo` (no se muestra al comprador).

Parámetros en `configuracion_plataforma`: `tendencias.dias_mar`, `tendencias.dias_aereo`, `tendencias.dias_produccion`, `tendencias.precio_cop` (vacío = no se vende) y `tendencias.dias_suscripcion` (30 por defecto). La migración siembra el calendario de temporadas hasta diciembre de 2027 y el cierre de fábricas de 2027 (20 ene – 28 feb, producción previa hasta el 15 ene).

---

## Publicación

- El curador programa la edición (`POST /tendencias/curaduria/ediciones/{id}/programar` con la hora en Bogotá; sin hora, publica ya). Requiere entre 1 y 6 productos, exactamente un destacado y fotos.
- Una tarea en el proceso del backend (`main.py`, cada `TENDENCIAS_PUBLICACION_MINUTOS`, 1 por defecto) publica las programadas cuya hora llegó y archiva la anterior. La transición es un UPDATE condicionado, así que con varios workers solo uno publica y envía el aviso.
- Aviso semanal: notificación en la app y correo a quienes lo autorizaron **y** tienen acceso vigente. El enlace lleva `?src=aviso&edicion=…` para medir `aviso_abierto`.
- Todo cambio del curador queda en `tendencias_cambios` (autor y fecha); los hechos sobre la edición publicada se marcan `sobre_publicada` para que el admin los vea.

---

## Pagos de la suscripción

`pagos` ahora tiene `concepto` (`creditos` o `suscripcion_tendencias`), `monto_cop` y `dias_acceso` (los días se fijan al crear el pago, así un cambio de tarifa no altera lo ya pagado).

1. `POST /tendencias/suscripcion/checkout` crea el pago pendiente y devuelve `checkout_url`.
2. El webhook `POST /pagos/webhook/wompi` con `payment.confirmed` activa el acceso (si el usuario ya tenía acceso, el periodo nuevo empieza cuando termina el anterior). `payment.refunded` lo revoca.
3. **Mientras la integración real con Wompi siga pendiente** (`WOMPI_SIMULATE=true`), fuera de producción existe `POST /tendencias/suscripcion/simular-pago/{pago_id}` para probar el flujo completo en local.

---

## Catálogos de empresas

Criterio por catálogo (más la lista manual, que siempre suma):

| `criterio` | Lo ven |
|------------|--------|
| `manual` | Solo los compradores que la empresa agrega |
| `tier_minimo` | Compradores con nivel de cotizante igual o superior a `tier_minimo` |
| `clientes_con_orden` | Compradores con al menos una orden con la empresa |
| `suscriptores_zarpi` | Compradores con acceso vigente a Tendencias |

La empresa solo puede agregar a mano a compradores que ya tuvieron trato con ella (`GET /catalogos/clientes`): solicitudes dirigidas, abiertas asignadas u órdenes. El comprador recibe una notificación.

---

## Solicitudes desde Tendencias o un catálogo

`POST /cotizaciones` acepta `origen` (`directa`, `tendencias`, `catalogo`) con `tendencia_edicion_id` + `tendencia_producto_id` o `catalogo_producto_id`. El backend valida que el comprador tenga acceso; una solicitud desde un catálogo debe ir **dirigida** a la empresa dueña. La cotización guarda el origen y el evento `solicitud_creada` lo lleva en `datos`.

`GET /tendencias/curaduria/metricas` responde por edición y por producto: vistas, guardados, clics en pedir propuestas, **solicitudes** (la métrica principal) y cuántas terminaron en orden.

Eventos (bitácora `eventos`, tipo `tendencias.*`): `edicion_vista`, `producto_visto`, `modo_cambiado`, `pedir_propuestas_clic`, `calendario_visto`, `aviso_abierto`, `video_reproducido` (los manda el navegador por `POST /tendencias/eventos`); `producto_guardado`, `guardado_quitado`, `aviso_suscrito` (los registra el servidor).

---

## Videos de los productos

Cada producto de Tendencias admite un video en dos encuadres, ambos opcionales (migración `20261007_0029`):

| Campo | Encuadre | Se muestra en |
|-------|----------|---------------|
| `video_horizontal` | 16:9 | Pantallas anchas (computador) |
| `video_vertical` | 9:16 | Celulares y tabletas en vertical |

Si solo hay uno, se muestra ese en todas las pantallas; si hay los dos, quien mira puede cambiar de versión. El video del **destacado** se reproduce directamente en su tarjeta; en los demás productos aparece primero en la galería de la ficha. El reproductor es el mismo de los cursos (`app/components/media/ReproductorVideo.tsx`), y el que elige el encuadre es `VideoAdaptable.tsx`. Cada reproducción registra el evento `tendencias.video_reproducido` con el encuadre visto.

## Fotos

Las fotos se suben al módulo documental y se guardan como rutas `/documentos/archivos/{id}/descargar`. `GET /documentos/archivos/{id}/descargar` ahora deja verlas a:

- la empresa que recibe una cotización (antes solo el comprador que la subió podía abrir sus fotos);
- quien tiene acceso a Tendencias, si la foto o el video es de un producto de Tendencias;
- los compradores que pueden ver el catálogo, si la foto es de un producto de un catálogo.

Las cotizaciones también aceptan ahora hasta **10 fotos** del producto (`fotos_producto`, migración `20261006_0027`); `foto_producto` queda como portada.

---

## Endpoints

### Comprador
| Método | Ruta | Acceso |
|--------|------|--------|
| GET | `/tendencias/acceso` | Sesión |
| POST | `/tendencias/suscripcion/checkout` | Solicitante |
| POST | `/tendencias/suscripcion/simular-pago/{pago_id}` | Dueño del pago, solo fuera de producción con `WOMPI_SIMULATE` |
| GET | `/tendencias/portada` | Sesión |
| GET | `/tendencias/edicion-actual` | Acceso vigente |
| GET | `/tendencias/ediciones`, `/tendencias/ediciones/{id}` | Acceso vigente |
| GET | `/tendencias/calendario` | Acceso vigente |
| GET | `/tendencias/guardados` · PUT/DELETE `/tendencias/guardados/{producto_id}` | Acceso vigente |
| PUT/DELETE | `/tendencias/aviso` | Acceso vigente (DELETE con sesión) |
| POST | `/tendencias/eventos` | Acceso vigente |
| GET | `/catalogos/disponibles`, `/catalogos/ver/{id}` | Sesión |

### Curador
`/tendencias/curaduria/…`: `ediciones` (GET, POST), `ediciones/{id}` (GET, PUT, DELETE si es borrador), `ediciones/{id}/productos` (PUT, lista completa), `ediciones/{id}/programar`, `ediciones/{id}/desprogramar`, `productos` (GET, POST), `productos/{id}` (GET, PUT), `calcular` (POST, cálculo en vivo), `temporadas`, `cierres`, `parametros` (GET), `metricas` (GET).

### Admin
`/tendencias/curaduria/ediciones/{id}/retirar`, `temporadas` (POST/PUT/DELETE), `cierres` (POST/DELETE), `parametros` (PUT), `cambios` (GET), `/tendencias/admin/accesos` (GET, POST cortesía), `/tendencias/admin/accesos/{id}/revocar`, `/tendencias/admin/curadores` (GET, PUT `?email=`).

### Empresa
`GET /catalogos/mios`, `POST /catalogos`, `PUT/DELETE /catalogos/{id}`, `POST /catalogos/{id}/productos`, `PUT/DELETE /catalogos/{id}/productos/{pid}`, `GET /catalogos/clientes`, `GET/POST /catalogos/{id}/accesos`, `DELETE /catalogos/{id}/accesos/{usuario_id}`.
