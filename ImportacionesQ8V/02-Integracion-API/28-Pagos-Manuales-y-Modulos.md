# Pagos manuales (comprobantes), tokens por cotización y módulos

> Backend: `models/comprobante.py`, `services/comprobantes.py`, `services/tokens_cotizacion.py`, `services/modulos.py`, `routers/comprobantes.py`. Migración `20261011_0036`.
> Frontend: *Pagos* (`features/pagos/CargueDescarguePagos.tsx`), *Admin › Pagos* (`features/admin/RevisionPagos.tsx`), *Admin › Módulos* (`features/admin/ModulosPlataforma.tsx`).

## Cargue y descargue de pagos

Mientras se habilita la pasarela, los pagos se hacen por transferencia. El precio por token y los datos de la cuenta los fija el admin en *Admin › Pagos › Configuración*.

**Carpetas.** Se ven en *Pagos* y se guardan en gestión documental bajo «Pagos/…»:

| Carpeta | Quién sube | Al aprobar |
|---|---|---|
| Comprobantes de cotizaciones (`tokens`) | El usuario | Se suman N tokens (`usuarios.puntos_cotizacion`) y queda un movimiento `recarga` |
| Suscripción Tendencias (`suscripcion`) | El comprador | N días de acceso a Tendencias (`otorgar_acceso`, origen `pago`) |
| Pagos del reto (`reto`) | El equipo, al marcar «Pagado» o después | Nada: el participante solo lo ve y lo descarga |

**Revisión.**
- El admin aprueba, poniendo cuántos tokens o días acredita, o rechaza con un motivo. El usuario recibe una notificación y un correo.
- El archivo de un comprobante solo lo pueden descargar quien pagó (o quien recibió el pago, en el reto) y el admin.

**Endpoints.**
- Usuario: `GET /comprobantes/resumen`, `GET /comprobantes?tipo=` y `POST /comprobantes`. El archivo se sube antes, con `origen=comprobante-pago`.
- Admin: `GET /comprobantes/admin`, `POST /comprobantes/{id}/aprobar|rechazar`, `POST /comprobantes/admin/reto` y `GET|PUT /comprobantes/admin/config`.
- Reto: `PATCH /reto/participaciones/{id}/pagado` acepta `archivo_id`.

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
