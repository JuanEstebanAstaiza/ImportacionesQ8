# Pagos manuales (comprobantes), tokens por cotización y módulos

> Backend: `models/comprobante.py`, `services/comprobantes.py`, `services/acceso_cursos.py`, `services/tokens_cotizacion.py`, `services/modulos.py`, `routers/comprobantes.py`. Migraciones `20261011_0036` y `20261013_0038`.
> Frontend: *Pagos* (`features/pagos/CargueDescarguePagos.tsx`), *Admin › Pagos* (`features/admin/RevisionPagos.tsx`), *Admin › Accesos a cursos* (`features/admin/AccesosCursos.tsx`), *Admin › Módulos* (`features/admin/ModulosPlataforma.tsx`).

## Cargue y descargue de pagos

Mientras se habilita la pasarela, los pagos se hacen por transferencia. El precio por token y los datos de la cuenta los fija el admin en *Admin › Pagos › Configuración*.

**Carpetas.** Se ven en *Pagos* y se guardan en gestión documental bajo «Pagos/…»:

| Carpeta | Quién sube | Al aprobar |
|---|---|---|
| Comprobantes de cotizaciones (`tokens`) | El usuario | Se suman N tokens (`usuarios.puntos_cotizacion`) y queda un movimiento `recarga` |
| Suscripción Tendencias (`suscripcion`) | El comprador | N días de acceso a Tendencias (`otorgar_acceso`, origen `pago`) |
| Cursos (`curso`, con `curso_id`) | El usuario, con el pago manual de cursos encendido | Acceso al curso (fila en `compras_curso`, origen `comprobante`) |
| Pagos del reto (`reto`) | El equipo, al marcar «Pagado» o después | Nada: el participante solo lo ve y lo descarga |

**Revisión.**
- El admin aprueba, poniendo cuántos tokens o días acredita, o rechaza con un motivo. El usuario recibe una notificación y un correo.
- El archivo de un comprobante solo lo pueden descargar quien pagó (o quien recibió el pago, en el reto) y el admin.
- **Copia a pagos@.** Cada comprobante que sube un usuario (tokens, suscripción o curso) llega a `PAGOS_EMAIL` (pagos@zarpi.co). Lleva adjuntos el comprobante y un PDF con el concepto (qué paga, valor, usuario, fecha, nota). «Responder» le escribe al usuario. Si el archivo pasa de `MAX_ADJUNTO_CORREO_BYTES` (10 MB), el correo dice que se abra desde *Admin › Pagos*. Si el correo no sale, el comprobante igual queda para revisar.

**Endpoints.**
- Usuario: `GET /comprobantes/resumen` (incluye `cursos_pago_manual`), `GET /comprobantes?tipo=`, `GET /comprobantes/cursos` (cursos con precio que aún no tiene; `pendiente` si ya mandó el comprobante) y `POST /comprobantes` (para un curso: `tipo="curso"` y `curso_id`; el valor es el precio del curso). El archivo se sube antes, con `origen=comprobante-pago`.
- Admin: `GET /comprobantes/admin`, `POST /comprobantes/{id}/aprobar|rechazar` (un curso se aprueba sin `cantidad`), `POST /comprobantes/admin/reto` y `GET|PUT /comprobantes/admin/config`.
- Reto: `PATCH /reto/participaciones/{id}/pagado` acepta `archivo_id`.

## Pago manual de cursos

Con el módulo `pago_manual_cursos` encendido (y el académico), cada curso con precio se desbloquea por persona:

1. En *Cursos*, «Comprar acceso» lleva a *Pagos* con una ventana: el concepto (el curso), el valor, los datos para transferir y la subida del comprobante. `POST /cursos/{id}/comprar` responde **402** para estos cursos.
2. Al usuario le llega el acuse desde pagos@, y a pagos@ la copia con los adjuntos.
3. En *Admin › Pagos* el admin aprueba («Dar acceso») o rechaza. Al aprobar, el usuario recibe un correo desde pagos@: «Ya tienes acceso a tu curso».
4. En *Admin › Accesos a cursos* el admin también da el acceso a mano por correo de la cuenta (por ejemplo, si el pago llegó por otro lado), ve quién tiene acceso a cada curso y de dónde salió, y lo quita.

Los cursos gratis siguen siendo de inscripción directa. Al apagar el módulo, cuando haya pasarela, la compra vuelve a ser directa y los accesos ya dados se mantienen. Los precios de los cursos están en COP (hasta 100.000.000).

**Cursos de Zarpi.** El admin crea, edita y elimina los cursos propios de la plataforma en *Admin › Cursos de Zarpi*, con el mismo editor que usan las importadoras (`POST|PUT|DELETE /cursos` aceptan el rol `admin`). Esos cursos no tienen empresa (`importador_id` vacío, migración `20261014_0039`) y en el catálogo salen como publicados por «Zarpi». El admin solo edita los de Zarpi, y cada importadora solo los suyos.

`CursoListItem.pago_manual` indica si el curso se paga así, y `CursoDetailResponse.comprobante_pendiente` si ya mandó el comprobante.

Endpoints de admin (`require_rol("admin")`; con el académico apagado, responden 404):
- `GET /admin/cursos/catalogo`: cursos publicados.
- `GET /admin/cursos/accesos?curso_id=&q=`: accesos con `origen` (`inscripcion`, `comprobante` o `manual`), quién lo dio y la nota.
- `POST /admin/cursos/accesos` con `{curso_id, email, nota?}`: 404 si no hay cuenta con ese correo y 409 si ya tiene acceso.
- `DELETE /admin/cursos/accesos/{id}`: quita el acceso. El progreso queda guardado.

## Categorías de cotizante (lista privada)

En *Admin › Cotizantes* el admin crea categorías (`categorias_cotizante`, migración `20261016_0041`). Cada una trae:
- **Tier**: queda fijo (`tier_manual`), como un tier puesto a mano. Vacío: no lo toca.
- **Días de Tendencias**: una cortesía de N días que empieza el día en que se asigna (`AccesoTendencias`, origen `cortesia`). Vacío: sin Tendencias.

Se asigna al crear el cotizante (`POST /admin/solicitantes` con `categoria_id`; si además viene `tier`, manda ese) o después (`PUT /admin/cotizantes/{id}/categoria`; los días se suman a los que tenga). Editar una categoría no cambia a quienes ya la tienen. Archivada (`activa=false`) ya no se asigna.

Endpoints: `GET|POST /admin/categorias-cotizante`, `PUT /admin/categorias-cotizante/{id}`. El listado de cotizantes trae `categoria_id` y `categoria`.

## 1 token por cotización

Con el módulo `cobro_cotizaciones` encendido, cada cotización de un comprador consume 1:
- primero una de las «cotizaciones gratis» del reto;
- si no le quedan, un token.

El token también desbloquea a las empresas de nivel superior, así que no se cobra dos veces. Sin saldo, la API responde **402** y el formulario manda a *Pagos*. El descuento es un UPDATE condicional en la misma transacción que crea la cotización.

## Módulos (`/admin/modulos`)

| Módulo | Por defecto (`.env`) | Apagado |
|---|---|---|
| `academico` | `MODULO_EDUCATIVO_HABILITADO` | Cursos fuera del menú; `/cursos` responde 404 |
| `registro` | `REGISTRO_PUBLICO_HABILITADO` | `/auth/register` responde 403. La landing y el login no ofrecen «Crear cuenta»; las cuentas las crea el equipo desde *Usuarios* |
| `cobro_cotizaciones` | `COBRO_COTIZACIONES_TOKENS` (encendido, salvo en tests) | Cotizar no consume tokens |
| `pago_manual_cursos` | `PAGO_MANUAL_CURSOS` (encendido, salvo en tests) | Los cursos se compran directo, como antes |

`/configuracion-publica` expone `registro_abierto`, `cobro_cotizaciones` y `correo_contacto`.

## Carpetas por módulo en gestión documental

Lo que se sube sin carpeta desde un módulo va a la suya (`documental_service.CARPETA_POR_ORIGEN`):

| Origen | Carpeta |
|---|---|
| `tendencias` | «Tendencias» |
| `catalogo` | «Catálogos» |
| `perfil-usuario` | «Perfil» |
| `presentacion-empresa` | «Presentación de empresa» |
| `comprobante-pago` | «Pagos» |

La migración `0036` movió a su carpeta lo que ya estaba suelto en la raíz.
