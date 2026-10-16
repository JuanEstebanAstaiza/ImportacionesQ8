# Pago de la orden (cliente → empresa importadora)

Cuando las dos partes aceptan la propuesta se genera la orden, pero todavía no está pagada. La plataforma no recibe ese dinero: solo guarda el comprobante y avisa a las dos partes.

## Flujo

1. **La orden nace como «Orden generada · pago pendiente».**
   - El valor guardado es `cotizacion_aceptada`. No se renombró para no romper los eventos, las métricas ni las órdenes que ya existen.
   - Se crea la **carpeta de pagos de la operación** en la gestión documental del cliente: `Pagos / Operaciones / ORD-XXXXXXXX · <producto>`. Si la orden es anterior a este módulo, la carpeta se crea la primera vez que el cliente abre el pago.
   - El mensaje del chat y el aviso al cliente le piden pagar y subir el comprobante en la sección «Pago» de la operación.
2. **El cliente envía el comprobante.**
   - Sube el archivo (imagen o PDF) a esa carpeta con la subida normal.
   - Lo envía con `POST /ordenes/{id}/pagos`.
   - La cuenta dueña de la empresa y el asesor asignado reciben el aviso, y queda constancia en el chat.
   - Mientras haya un comprobante por confirmar, el cliente no puede enviar otro.
3. **La empresa lo revisa.** Pueden revisarlo la cuenta dueña y el asesor asignado, que son los mismos que mueven el estado.
   - **Confirmar:** el pago queda confirmado y se avisa al cliente.
   - **Rechazar con motivo:** el cliente recibe el motivo y puede enviar otro comprobante.
4. **Producción.** Con el pago confirmado, la empresa pasa la orden a **«Orden en producción»** (`en_produccion`), tanto si hay que fabricar el producto como si ya está hecho. Sin pago confirmado, `PUT /ordenes/{id}/estado` hacia `en_produccion` responde **409**.

## Endpoints

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| GET | `/ordenes/{id}/pagos` | Cliente, empresa (dueña o asesores) y admin | Devuelve `pago_confirmado`, `comprobante_por_revisar`, `monto_acordado` (total del formulario de la propuesta), `comprobantes[]`, `puede_subir` y `puede_revisar`. Al cliente le devuelve también `carpeta_id` |
| POST | `/ordenes/{id}/pagos` | Cliente | Body: `{archivo_id, monto_cop?, nota?}`. El archivo tiene que ser suyo y ser una imagen o un PDF. Lo mueve a la carpeta de la operación. 409 si ya hay uno por confirmar o el pago ya está confirmado |
| POST | `/ordenes/{id}/pagos/{comprobante_id}/confirmar` | Cuenta dueña o asesor asignado | Confirma el pago |
| POST | `/ordenes/{id}/pagos/{comprobante_id}/rechazar` | Cuenta dueña o asesor asignado | Body: `{motivo}` (5 a 300 caracteres) |

- **Descarga del comprobante:** el archivo se descarga por `/documentos/archivos/{id}/descargar`. Pueden bajarlo el cliente, la empresa de la orden y el admin.
- **Tabla:** `comprobantes_pago_orden`, creada por la migración `20261018_0044`.

## Frontend

- `features/ordenes/PagoOrden.tsx` es la tarjeta «Pago de la orden» del detalle de la operación. Muestra:
  - el valor acordado;
  - el estado: pago pendiente, comprobante en revisión o pago confirmado;
  - el formulario del cliente;
  - la lista de comprobantes, con «Confirmar pago recibido» y «No llegó / rechazar» para la empresa.
- Mientras el pago no esté confirmado, el botón «Marcar «Orden en producción»» queda deshabilitado.
- **Servicio:** `services/pagosOrden.service.ts`.
