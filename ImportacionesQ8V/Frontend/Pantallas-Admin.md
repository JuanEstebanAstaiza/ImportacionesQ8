# 👨‍💼 Pantallas de Administración — ImportacionesQ8

## Descripción general

Documentación de las pantallas P1 para el equipo de administración de la plataforma (miembros del equipo interno). Construidas con **React/Next.js** con TypeScript.

---

## 📋 Inventario de pantallas de admin

| # | Pantalla | Módulo | Prioridad |
|---|----------|--------|-----------|
| 14 | Panel de administración interno (disputas) | Admin | P1 |

---

## Pantalla 14 · Panel de Administración Interno — Disputas

> Visibilidad de todas las cotizaciones abiertas, chats, órdenes y pagos, para poder mediar en disputas.

### Estructura de la pantalla

```
┌─────────────────────────────────────┐
│  [Logo]          [Notificaciones]   │
├─────────────────────────────────────┤
│  Cotizaciones Abiertas | Disputas   │
│  Importadores Vinculados            │
├─────────────────────────────────────┤
│                                     │
│  ── Cotizaciones Abiertas Activas (5)│
│                                     │
│  ┌───────────────────────────┐      │
│  │ 📦 Textiles - China       │      │
│  │ Solicitante: Empresa A    │      │
│  │ Importadores matching: 3  │      │
│  │ Propuestas recibidas: 2/3 │      │
│  │ Ventana restante: 18h     │      │
│  │ [Ver detalle]             │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Disputas Activas (2) ──         │
│                                     │
│  ┌───────────────────────────┐      │
│  │ ⚠️ Orden #ORD-003        │      │
│  │ Estado: En disputa        │      │
│  │ Solicitante: Empresa B    │      │
│  │ Importador: Importadora C │      │
│  │ Motivo: Pedido con daño   │      │
│  │ [Mediar]                  │      │
│  └───────────────────────────┘      │
│                                     │
│  ── Importadores Vinculados (12)    │
│                                     │
│  ┌───────────────────────────┐      │
│  │ 🏢 Importadora ABC        │      │
│  │ Estado: ✅ Activo         │      │
│  │ Especialidad: Textiles    │      │
│  │ Calificación: ⭐⭐⭐⭐⭐   │      │
│  │ Verificado: ✅            │      │
│  │ [Verificar] [Desactivar]  │      │
│  └───────────────────────────┘      │
│                                     │
├─────────────────────────────────────┤
│   Mi Perfil          Cerrar Sesión  │
└─────────────────────────────────────┘
```

### Vista de detalle de disputa

```
┌─────────────────────────────────────┐
│  ← Volver                           │
├─────────────────────────────────────┤
│                                     │
│   ⚠️ Disputa - Orden #ORD-003       │
│                                     │
│  ── Información de la Orden ──      │
│                                     │
│  Solicitante: Empresa B             │
│  Importador: Importadora C          │
│  Asesor: Juan Pérez                 │
│  Producto: Electrónica - China      │
│  Precio acordado: $200.00 USD       │
│  Estado actual: En disputa          │
│                                     │
│  ── Motivo de la Disputa ──         │
│                                     │
│  "El producto llegó dañado,        │
│   necesito reembolso"               │
│                                     │
│  ── Historial de Estados ──         │
│                                     │
│  ✅ Cotización aceptada - 01/07     │
│  ✅ En producción - 05/07           │
│  ✅ En tránsito internacional - 10/07│
│  ⚠️ En disputa - 20/07             │
│                                     │
│  ── Chat de la Orden ──             │
│                                     │
│  [Historial completo del chat]      │
│                                     │
│  ── Documentos Adjuntos ──          │
│                                     │
│  📄 Factura Proforma                │
│  📄 Packing List                    │
│  📷 Fotos del daño (adjuntas)       │
│                                     │
├─────────────────────────────────────┤
│   [Intervenir]  [Cerrar Disputa]    │
└─────────────────────────────────────┘
```

### Componentes necesarios

- **Tabs de navegación:** Cotizaciones Abiertas | Disputas | Importadores Vinculados
- **Tarjeta de cotización abierta activa:** Solicitante, importadores matching, propuestas recibidas, ventana restante
- **Tarjeta de disputa:** Orden, solicitante, importador, motivo, botón "Mediar"
- **Tarjeta de importador vinculado:** Estado (activo/inactivo), especialidad, calificación, verificado, botones de acción
- **Vista de detalle de disputa:** Información completa de la orden, motivo de la disputa, historial de estados, chat, documentos

### Acciones del admin en disputas

| Acción | Descripción |
|--------|-------------|
| Intervenir | El admin puede enviar un mensaje al solicitante y al importador para mediar en el conflicto |
| Cerrar Disputa | El admin puede resolver la disputa a favor de una parte o con reembolso parcial/total |

---

## 📝 Criterios de diseño transversales para el admin

- **Visibilidad total:** El equipo de administración debe poder ver todas las cotizaciones abiertas, chats y órdenes en tiempo real.
- **Acciones rápidas:** Los botones de acción (Mediar, Verificar, Desactivar) deben estar siempre visibles y accesibles desde la vista principal.
- **Alertas visuales:** Las disputas activas deben tener un indicador visual prominente (color rojo o amarillo).