# Pantallas del Admin — ImportacionesQ8

## Descripción general

Documentación de las pantallas P0 y P1 para el administrador (equipo interno que gestiona la plataforma). Construidas con **React/Next.js** con TypeScript.

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