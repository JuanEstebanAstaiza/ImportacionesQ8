# 29 · Planes de acceso (pago manual)

Textos de la sección: `zarpi-home-copy-v1.md` (raíz del repositorio). Código: `backend/models/plan.py`, `backend/services/planes.py`, `backend/routers/planes.py`; frontend `features/planes/*` y `features/admin/PlanesAdmin.tsx`. Migración `20261017_0042_planes`.

## Qué resuelve

- La sección **Planes** del inicio (`/#planes`) lee los planes del admin: precio sin IVA, IVA, total, lo que incluyen y cupos restantes. **Ningún valor está escrito en el frontend.**
- «Inscribirme» abre `/planes/inscripcion?plan=<clave>`, una pantalla **pública**: la persona deja sus datos (los mismos del registro), acepta las condiciones y la autorización de datos y sube el comprobante de la transferencia.
- El equipo lo verifica en **Admin › Planes** y lo **activa**. La activación:
  - crea la cuenta de comprador, o usa la que ya tiene ese correo;
  - acredita las solicitudes con su vigencia;
  - si el plan lo trae, da los días de Tendencias;
  - a una cuenta nueva le manda un enlace para crear la contraseña, que vale 7 días.

  O lo **rechaza** con motivo, y el cupo se libera.
- Sin cupos, la misma pantalla deja a la persona en la **lista de espera**, sin comprobante.

La migración siembra el **Paquete Importador** y el **Plan VIP** del copy v1, sin límite de cupos. Los cupos se fijan en Admin › Planes.

## Saldo y cobro

- `usuarios.solicitudes_plan`, `plan_id`, `plan_vence_en`: las solicitudes del plan solo valen hasta `plan_vence_en`.
- Con el módulo **Cobro por cotización** encendido, cada solicitud gasta una unidad en este orden:
  1. las gratis del reto;
  2. las del plan vigente;
  3. los tokens sueltos, que no vencen.
- La cotización guarda qué unidad gastó: `cotizaciones.unidad_cobrada` = `gratis` | `plan` | `token`.
- **Devolución a las 72 horas:** una tarea de `main.py` corre cada `DEVOLUCION_SOLICITUDES_MINUTOS` (60 por defecto; 0 la apaga). Las solicitudes con 72 horas sin ninguna propuesta devuelven la unidad al mismo saldo, quedan con `unidad_devuelta_en` y se avisa al comprador. Un candado en Redis y un UPDATE condicional evitan devolver dos veces.
- **Renovación:** si se activa un plan con otro vigente, lo que quedaba se suma y la nueva vigencia corre desde el vencimiento anterior.
- **Solicitud adicional:** si el plan vigente tiene `precio_solicitud_adicional_cop` (VIP: $25.000 + IVA), ese es el precio por token que ve el comprador en Pagos (`GET /comprobantes/resumen` → `precio_token_cop`, con IVA). Sin él, rige el precio general.

## Endpoints

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/planes` | Público | Planes activos con `precio_cop`, `iva_cop`, `total_cop`, `incluye[]` y `cupos_restantes` (`null` = sin límite); también `datos_pago` |
| POST | `/planes/{clave}/inscripcion` | Público (con sesión, la asocia a la cuenta) | multipart: `datos` (JSON) + `comprobante` (PDF/JPG/PNG/WEBP ≤ 10 MB, se valida la firma del archivo). 409 `{"codigo":"sin_cupos"}` si no quedan cupos; 409 si ya hay una pendiente con ese correo |
| POST | `/planes/{clave}/lista-espera` | Público | JSON con los mismos `datos` |
| GET | `/planes/admin/planes` | Admin | Todos los planes, con conteo de inscripciones por estado |
| POST | `/planes/admin/planes` | Admin | Crear (`clave` en minúsculas: es la del enlace) |
| PUT | `/planes/admin/planes/{id}` | Admin | Editar. No cambia las inscripciones ya hechas, que guardan lo que costaban |
| GET | `/planes/admin/inscripciones?estado=` | Admin | `pendiente` \| `activa` \| `rechazada` \| `lista_espera` |
| GET | `/planes/admin/inscripciones/{id}/comprobante` | Admin | Descarga el comprobante |
| POST | `/planes/admin/inscripciones/{id}/activar` | Admin | Crea o usa la cuenta y acredita el plan |
| POST | `/planes/admin/inscripciones/{id}/rechazar` | Admin | `{"motivo": "..."}`; le llega a la persona |

`datos`: `email`, `tipo_persona` (`natural` \| `juridica`).
- Si es natural: `nombre`, `apellido`, `tipo_documento`, `numero_documento`.
- Si es jurídica: `razon_social`, `nit`.
- Comunes: `indicativo_pais_telefono`, `telefono`, `ciudad?`, `acepto_condiciones` y `acepto_datos` (ambos deben ser `true`).

## Correos

- **A `PAGOS_EMAIL`:** la inscripción, con el comprobante y un PDF de concepto adjuntos; «responder» le escribe a la persona.
- **A la persona:**
  - el acuse al inscribirse;
  - la activación, con enlace y código para crear la contraseña;
  - el rechazo, con el motivo;
  - la confirmación de la lista de espera.
- **A los admins:** aviso en la campana, que lleva a `/admin/planes`.

## Archivos

Los comprobantes se guardan en `backend/uploads/planes/`, que va en el volumen `backend_uploads`. No pasan por gestión documental porque quien los sube todavía no tiene cuenta. Solo el admin los descarga.

## Pendiente

- **«Condiciones de los planes»:** la página `/condiciones-de-los-planes` es un **borrador provisional**, marcado así en pantalla. Hay que reemplazarlo por el documento «Textos legales y de pantalla del módulo de Planes».
- **Política de Pagos:** la versión aprobada dice que una solicitud sin propuestas no da reembolso automático; hay que alinearla con la devolución a las 72 horas.
