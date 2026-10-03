# Pantallas del Admin — Zarpi

> **Última actualización:** 2026-10-01

## Descripción general

Documentación de las pantallas P0 y P1 para el administrador (equipo interno que gestiona la plataforma). Construidas con **Vite + React** con TypeScript.

---

## Estado actual (2026-10-03)

> Las secciones de abajo ("Pantalla 10") son el diseño original del MVP. El panel real está en `src/pages/admin/AdminDashboard.tsx`; cada sección tiene su entrada en el menú lateral y su URL ([[Routing-y-Roles-Frontend]]).

| Sección (menú) | URL | Qué permite | Componente | API |
|----------------|-----|-------------|------------|-----|
| Resumen | `/admin` | Empresas activas y verificadas, cotizaciones, órdenes en disputa, cotizaciones abiertas recientes | `AdminDashboard` | `GET /admin/metricas` |
| Empresas | `/admin/empresas` | Alta de empresa con cuenta dueña, datos de contacto, verificación con expediente, retirar verificación, activar/desactivar | `AdminDashboard` | [[12-Admin]] |
| **Asignación** | `/admin/asignacion` | Solicitudes abiertas por asignar (con cuánto llevan esperando), botón **«Asignar a»** con el encaje y desempeño de cada empresa, quitar asignaciones; modo manual o automático, cupo de empresas por solicitud y TRM de respaldo | `features/admin/AsignacionSolicitudes.tsx` | [[23-Asignacion-de-Solicitudes]] |
| Usuarios | `/admin/usuarios` | Buscar por rol y estado, activar/desactivar, invitar | `AdminDashboard` | [[12-Admin]] |
| Cotizantes | `/admin/cotizantes` | Tier de cada cotizante (manual o automático), umbrales, puntos y su historial, recalcular tiers | `features/admin/GestionCotizantes.tsx` | [[18-Tiers-y-Perfil-Cotizante]] |
| Correos | `/admin/correos` | Campañas a usuarios por rol, por usuario o por correo (hasta 500 destinatarios) | `features/admin/AdminEmailCampaign.tsx` | `POST /admin/correos/masivo` |
| Soporte | `/admin/soporte` | Bandeja de tickets por urgencia y nivel, equipo de soporte, supervisión de chats, disputas, editor del centro de ayuda | `AdminDashboard`, `features/help/EditorDocumentacion.tsx` | [[21-Ayuda-y-Soporte]] · [[12-Admin]] |
| Certificaciones | `/admin/certificaciones` | Crear sellos de la plataforma (logo, descripción, peso publicitario), otorgarlos y retirarlos | `AdminDashboard` | [[12-Admin]] |
| **Respaldos** | `/admin/respaldos` | Descargar copia ZIP; **arrastrar un ZIP para restaurar** con vista previa y confirmación; volver a estados anteriores | `features/admin/RestaurarBackup.tsx` | [[Backups-y-Restauracion]] |
| Landing | `/admin/landing` | Editar los bloques de la landing pública, aliados y noticias | `features/admin/LandingCmsEditor.tsx` | [[22-Landing-CMS]] |
| Chats / Documentos | `/chats`, `/documentos` | Lectura de conversaciones y módulo documental | — | [[08-Chat-y-WebSocket]] · [[17-Documentos-y-Multimedia]] |

El rol **soporte** ve solo Bandeja (`/admin/soporte`), Tickets (`/chats`) y Documentos.

---

## Inventario de pantallas del admin

| # | Pantalla | Módulo | Prioridad |
|---|----------|--------|-----------|
| 10 | Panel de administración interno — cotizaciones abiertas, disputas e importadores vinculados | Admin | P0 |

---

## Pantalla 10 · Panel de Administración Interno

> Vista completa para el equipo de administración: cotizaciones abiertas activas, órdenes en disputa y gestión de importadores.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  [Logo]          [Notificaciones]   │
├─────────────────────────────────────┤
│  Cotizaciones | Disputas | Import.  │
├─────────────────────────────────────┤
│                                     │
│  ── Cotizaciones Abiertas Activas ── │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Textiles - China          │      │
│  │ Solicitante: Empresa A    │      │
│  │ Importadores matching: 3  │      │
│  │ Propuestas recibidas: 2   │      │
│  │ Ventana restante: 48h     │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Órdenes en Disputa ──           │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Orden #ORD-003            │      │
│  │ Estado: En disputa        │      │
│  │ Solicitante: Empresa A    │      │
│  │ Importador: ABC           │      │
│  │ Motivo: Producto defectuoso│     │
│  │ [Mediar]                  │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Importadores Vinculados ──       │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Importadora ABC           │      │
│  │ Estado: Activo            │      │
│  │ Especialidad: Textiles    │      │
│  │ Calificacion: 4.8         │      │
│  │ Verificado: Si            │      │
│  │ [Verificar] [Desactivar]  │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   Mi Perfil          Cerrar Sesión  │
└─────────────────────────────────────┘
```

### Vista de disputa detallada

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│  ⚠️ Disputa - Orden #ORD-003        │
│                                     │
│  Solicitante: Empresa A             │
│  Importador: Importadora ABC        │
│  Motivo: Producto defectuoso        │
│                                     │
│  ── Historial de la disputa ──      │
│                                     │
│  [20/07]                            │
│  Solicitante reporta problema       │
│  ──────────────────────────────     │
│                                     │
│  Importador responde                │
│  ──────────────────────────────     │
│                                     │
│  Admin: Se abre mediación           │
│  ──────────────────────────────     │
│                                     │
│  ── Evidencia adjunta ──            │
│  📷 Fotos del daño (adjuntas)       │
│  📄 Correo electrónico              │
│                                     │
├─────────────────────────────────────┤
│   [Resolver a favor solicitante]    │
│   [Resolver a favor importador]     │
└─────────────────────────────────────┘
```

### Vista de detalle de cotización abierta

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│  Textiles - China                   │
│  Solicitante: Empresa A             │
│                                     │
│  ── Importadores Matching ──        │
│                                     │
│  Importadora ABC                    │
│  Estado: Propuesta enviada          │
│  Precio: $150.00 USD                │
│                                     │
│  Importadora XYZ                    │
│  Estado: Pendiente                  │
│                                     │
│  ── Ventana de respuestas ──        │
│  Tiempo restante: 48h               │
│                                     │
├─────────────────────────────────────┤
│   [Forzar cierre de ventana]        │
└─────────────────────────────────────┘
```

### Vista de detalle de importador

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│  Importadora ABC                    │
│                                     │
│  ── Información General ──          │
│  Nombre: Importadora ABC            │
│  Logo: [logo]                       │
│  Especialidad: Textiles, Ropa       │
│  Paises origen: China, Vietnam      │
│  Calificacion: 4.8                  │
│  Tiempo respuesta promedio: ~24h    │
│  Capacidad volumen: 1000 unidades   │
│  Estado: Activo                     │
│  Verificado: Si                     │
│                                     │
│  ── Cotizaciones Recientes ──       │
│  Textiles - China                   │
│  Estado: Orden activa               │
│                                     │
├─────────────────────────────────────┤
│   [Verificar] [Desactivar]          │
└─────────────────────────────────────┘
```

### Vista de detalle de orden con línea de estados

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│  Orden #ORD-001                     │
│  Electrónica - China                │
│                                     │
│  ── Estado Actual: En Tránsito ──    │
│                                     │
│  Cotización aceptada     [completado]│
│  En producción             [completado]│
│  En tránsito internacional  [actual] │
│  En aduana / nacionalizacion   [pendiente]│
│  En bodega local               [pendiente]│
│  Entregado                     [pendiente]│
│                                     │
│  ── Información de la Orden ──       │
│  Solicitante: Empresa A             │
│  Importador: Importadora ABC        │
│  Asesor: Maria Lopez                │
│  Precio acordado: $150.00 USD       │
│  Tiempo estimado: 30 días           │
│                                     │
│  ── Historial de Estados ──         │
│  [completado] Cotización aceptada - 05/07│
│  [completado] En producción - 08/07   │
│  [actual] En tránsito internacional - 12/07│
│                                     │
│  ── Documentos Adjuntos ──          │
│  Factura Proforma                   │
│  Packing List                       │
│                                     │
├─────────────────────────────────────┤
│   [Chat con Asesor]  [Reportar      │
│                       Problema]     │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Tabs de navegación:** Cotizaciones | Disputas | Importadores (cambio de vista)
- **Tarjeta de cotización abierta:** Solicitante, importadores matching, propuestas recibidas, ventana restante
- **Tarjeta de disputa:** Orden, solicitante, importador, motivo, botón "Mediar"
- **Tarjeta de importador vinculado:** Estado, especialidad, calificación, verificado, botones de acción
- **Linea de estados visual:** Timeline horizontal con indicadores ([completado], [actual], [pendiente])

### Estados de la orden (iconos)

| Estado | Icono | Color |
|--------|-------|-------|
| Cotización aceptada | [completado] | Verde |
| En producción | [completado] | Verde |
| En tránsito internacional | [actual] | Azul |
| En aduana / nacionalizacion | [pendiente] | Gris |
| En bodega local | [pendiente] | Gris |
| Entregado | [completado] | Verde |

### Estados de cotizaciones (etiquetas de color)

| Estado | Color | Descripción |
|--------|-------|-------------|
| Cotización creada | Azul | Recién creada, sin enviar |
| Dirigida | Verde | Enviada a importador específico |
| Abierta / Propuestas recibidas | Amarillo | Respuestas de la red de importadores |
| Cotización aceptada | Morado | Aceptó oferta, pendiente de pago |
| Orden activa | Naranja | Pago confirmado, orden en curso |

### Estados de órdenes (iconos)

| Estado | Icono | Color |
|--------|-------|-------|
| Cotización aceptada | [completado] | Verde |
| En producción | [completado] | Verde |
| En tránsito internacional | [actual] | Azul |
| En aduana / nacionalizacion | [pendiente] | Gris |
| En bodega local | [pendiente] | Gris |
| Entregado | [completado] | Verde |

---

## Criterios de diseno transversales para el admin

- **Estado siempre visible:** En cualquier pantalla de orden o cotización, el administrador debe poder ver en qué punto del proceso está.
- **Acciones claras:** Los botones de acción (Mediar, Verificar, Desactivar) deben ser claros y con confirmación antes de ejecutar.