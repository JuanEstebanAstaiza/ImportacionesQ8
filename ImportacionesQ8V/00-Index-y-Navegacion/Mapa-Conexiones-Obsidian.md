# Mapa de Conexiones del Proyecto ImportacionesQ8

## Diagrama principal de relaciones entre notas

```mermaid
graph LR
    subgraph Maestros["Documentos Maestros"]
        A[Propuesta-Completa]
        B[Resumen-Ejecutivo]
        C[Arquitectura-Tecnologica]
    end

    subgraph Backend["Backend"]
        D[API-Rest]
        E[Base-Datos]
        F[Autenticacion]
        G[Pagos-Wompi]
        H[Chat-WebSocket]
        I[Matching-Cotizaciones]
        U[Seguridad]
    end

    subgraph Frontend["Frontend"]
        J[Pantallas-Solicitante]
        K[Pantallas-Importador]
        L[Pantallas-Admin]
        M[Wireframes]
        N[UX-UI-Guia]
    end

    subgraph Fases["Fases de Desarrollo"]
        O[Semana-1-Fundaciones-y-Cotizaciones]
        P[Semana-2-Red-y-Ordenes]
        Q[Semana-3-Chat-y-Pulido]
        V[Semana-4-Asesores-Creditos-Registro]
    end

    subgraph Inversionistas["Inversionistas"]
        R[Pitch-Inversionistas]
        S[Modelo-Negocio]
        T[Metricas-MVP]
    end

    A --> B
    A --> C
    A --> D
    A --> J
    A --> O
    A --> R

    C --> D
    C --> E
    C --> F
    C --> G
    C --> H
    C --> I
    C --> U
    D --> U
    F --> U
    G --> U
    C --> J
    C --> K
    C --> L

    D --> O
    D --> P
    D --> Q
    D --> V

    E --> O
    E --> P
    E --> V

    F --> O
    F --> V

    G --> P
    G --> V

    H --> Q

    I --> P

    J --> O
    J --> P
    J --> Q
    J --> V

    K --> P
    K --> Q

    L --> Q

    M --> O
    M --> P
    M --> Q

    N --> O
    N --> P
    N --> Q

    U --> V

    R --> S
    R --> T
```

---

## Mapa de dependencias técnicas (Backend)

```mermaid
graph TD
    A[FastAPI - Backend] --> B[MySQL - Base de datos principal]
    A --> C[Redis - Chat/Cache]
    A --> D[JWT - Autenticación]
    A --> E[Wompi - Pagos]
    A --> F[WebSockets - Chat en tiempo real]

    B --> G[Usuarios]
    B --> H[Importadores]
    B --> I[Cotizaciones]
    B --> J[Ordenes]
    B --> K[Pagos]

    C --> L[Pub/Sub - Mensajería chat]
    C --> M[Caché de sesiones]
    C --> N[Estado cotizaciones abiertas]

    D --> O[Tokens JWT solicitante]
    D --> P[Tokens JWT importador]
    D --> Q[Tokens JWT admin]

    E --> R[Checkout Wompi - compra de créditos]
    E --> S[Webhooks de confirmación - acredita créditos]

    F --> T[Chat 1 a 1 por orden]

    B --> U[Movimientos de crédito]
    B --> V[Solicitudes de recreación]
    B --> W[Tokens de recuperación de contraseña]
```

---

## Mapa de dependencias técnicas (Frontend)

```mermaid
graph TD
    A[React/Next.js - Frontend] --> B[Pantallas Solicitante]
    A --> C[Pantallas Importador]
    A --> D[Pantallas Admin]

    B --> E[Login/Registro]
    B --> F[Dashboard Solicitante]
    B --> G[Selección de Modalidad]
    B --> H[Catálogo de Importadores]
    B --> I[Formulario Cotización]
    B --> J[Panel Propuestas Recibidas]
    B --> K[Checkout Pago Wompi]
    B --> L[Detalle Orden]
    B --> M[Chat con Asesor]

    C --> N[Bandeja Solicitudes Importador]
    C --> O[Formulario Respuesta Cotización]
    C --> P[Perfil Empresa Importadora]

    D --> Q[Panel Administración Disputas]

    E --> R[API REST - Autenticación]
    F --> S[API REST - Cotizaciones]
    G --> S
    H --> S
    I --> S
    J --> T[WebSockets - Propuestas en tiempo real]
    K --> U[Pasarela Wompi]
    L --> V[API REST - Órdenes]
    M --> W[WebSockets - Chat]

    N --> X[API REST - Solicitudes importador]
    O --> Y[API REST - Respuesta cotización]
```

---

## Mapa de flujo de datos del negocio (actualizado — Semana 4: créditos y doble aceptación)

```mermaid
graph LR
    Z[Solicitante compra créditos vía Wompi] --> A[Solicitante]
    A --> B[Nueva Cotización - descuenta créditos según modalidad]
    B --> C{Modalidad}
    C -->|Dirigida| D[Importador específico]
    C -->|Abierta| E[Todos los importadores de la red]
    D --> F1[Asesor redacta borrador]
    E --> F1
    F1 --> F2[Dueño valida categoría y envía propuesta]
    F2 --> H[Solicitante puede chatear y aceptar]
    H --> DA{Doble aceptación<br/>solicitante + empresa}
    DA -->|Falta un lado| H
    DA -->|Ambos aceptan| L[Orden creada automáticamente<br/>sin pago de por medio]
    L --> M[Chat traspasado al dueño/supervisor]
    M --> N[Seguimiento de orden a discreción de las partes]
```

> La plataforma **no cobra por la orden**: el único costo para el solicitante es el crédito consumido al crear la cotización. La plataforma solo conecta; el cumplimiento de la orden es responsabilidad de las partes.

---

## Mapa de flujo de datos del negocio (Importador, actualizado — Semana 4)

```mermaid
graph TD
    A[Empresa Importadora] --> B[Registro por admin de la plataforma]
    B --> C[Definir perfil: países, categorías, capacidad]
    B --> C2[Crear cuentas de asesor]
    C --> D[Recibe notificaciones]
    C2 --> D
    D --> E{Tipo de solicitud}
    E -->|Dirigida| F[Solicitud exclusiva del importador]
    E -->|Abierta| G[Solicitud compartida con la red - solo si categoría congruente]
    F --> H1[Asesor reclama y redacta borrador]
    G --> H1
    H1 --> H2[Dueño valida y envía propuesta]
    H2 --> I[Solicitante pre-acepta / asesor o dueño pre-acepta]
    I --> J{Ambos lados aceptaron?}
    J -->|No| I
    J -->|Sí| K[Cotización → Orden automática]
    K --> L[Chat traspasado al dueño - ahora supervisor]
    L --> M[Gestión de orden desde panel importador]
```

---

## Mapa de estados de una cotización/orden (actualizado — Semana 4)

```mermaid
stateDiagram-v2
    [*] --> Cotizacion_Creada: Solicitante envía formulario (descuenta créditos)
    Cotizacion_Creada --> Cotizacion_Dirigida: Modalidad dirigida
    Cotizacion_Creada --> Cotizacion_Abierta: Modalidad abierta

    Cotizacion_Dirigida --> Asesor_Redactando: Asesor de la empresa (categoría congruente) reclama y redacta borrador
    Cotizacion_Abierta --> Asesores_Redactando: Asesores de empresas de la red (categoría congruente) redactan borradores

    Asesor_Redactando --> Propuesta_Enviada: Dueño valida y envía
    Asesores_Redactando --> Propuestas_Enviadas: Dueños validan y envían

    Propuesta_Enviada --> Negociacion_Chat: Solicitante y asesor negocian por chat
    Propuestas_Enviadas --> Negociacion_Chat: Solicitante elige con quién negociar

    Negociacion_Chat --> Preaceptada_Parcial: Un lado (solicitante o empresa) pre-acepta
    Preaceptada_Parcial --> Negociacion_Chat: El otro lado revierte o aún no acepta
    Preaceptada_Parcial --> Cotizacion_Aceptada: El otro lado también pre-acepta (doble aceptación)
    Negociacion_Chat --> Cotizacion_Cerrada: Alguna parte rechaza definitivamente

    Cotizacion_Aceptada --> Orden_Activa: Orden creada automáticamente, chat traspasado al dueño/supervisor

    Orden_Activa --> En_Produccion: Importador confirma fabricación
    En_Produccion --> Transito_Internacional: Salida de fábrica/puerto origen
    Transito_Internacional --> Aduana_Nacionalizacion: Proceso de importación en país destino
    Aduana_Nacionalizacion --> Bodega_Local: Producto recibido en bodega del importador
    Bodega_Local --> Entregado: Cierre de la orden

    Cotizacion_Aceptada --> Cancelada_Por_Error: Solicitud de recreación aprobada por admin
    Cancelada_Por_Error --> [*]

    Entregado --> [*]
```

---

## Mapa de roles y permisos (actualizado — Semana 4)

```mermaid
graph TD
    A[Roles del Sistema] --> B[Solicitante]
    A --> C[Importador - dueño]
    A --> C2[Asesor - renombrado de trabajador]
    A --> D[Admin Plataforma]

    B --> B1[Crear cotizaciones - consume créditos]
    B --> B2[Ver órdenes propias]
    B --> B3[Chat con asesor/dueño asignado]
    B --> B4[Comprar créditos vía Wompi]
    B --> B5[Ver panel de propuestas - modalidad abierta]
    B --> B6[Pre-aceptar propuesta - doble aceptación]
    B --> B7[Solicitar recreación por error]

    C --> C1[Recibir solicitudes dirigidas]
    C --> C3[Enviar propuesta tras validar categoría]
    C --> C4[Gestionar órdenes propias - vía chat traspasado]
    C --> C5[Pre-aceptar propuesta como dueño]
    C --> C6[Editar perfil de empresa]
    C --> C7[Crear/gestionar cuentas de asesor]

    C2 --> C2a[Reclamar cotizaciones del pool de su empresa]
    C2 --> C2b[Redactar/editar borradores de propuesta]
    C2 --> C2c[Chat con el solicitante hasta el traspaso]
    C2 --> C2d[Pre-aceptar en nombre de la empresa]

    D --> D1[Ver todas las cotizaciones abiertas]
    D --> D2[Mediar en disputas]
    D --> D3[Gestionar importadores vinculados - crear, verificar]
    D --> D4[Monitorear métricas del sistema]
    D --> D5[Resolver solicitudes de recreación de cotización]
```

---

## Mapa de wireframes por módulo

```mermaid
graph LR
    subgraph Acceso["Acceso"]
        A1[Pantalla 1: Login/Registro]
    end

    subgraph Cotizaciones["Cotizaciones"]
        B1[Pantalla 2: Dashboard Solicitante]
        B2[Pantalla 3: Selección de Modalidad]
        B3[Pantalla 4: Catálogo Importadores]
        B4[Pantalla 5: Formulario Cotización]
        B5[Pantalla 6: Panel Propuestas Recibidas]
    end

    subgraph Pagos["Pagos"]
        C1[Pantalla 7: Checkout Wompi]
    end

    subgraph Ordenes["Ordenes"]
        D1[Pantalla 8: Detalle de Orden]
    end

    subgraph Chat["Chat"]
        E1[Pantalla 9: Chat con Asesor]
    end

    subgraph Importador["Panel Importador"]
        F1[Bandeja Solicitudes Importador]
        F2[Formulario Respuesta Cotización]
    end

    A1 --> B1
    B1 --> B2
    B2 --> B3
    B2 --> B4
    B3 --> B5
    B4 --> B6
    B5 --> C1
    C1 --> D1
    D1 --> E1
```

---

## Mapa de tareas por semana (Gantt simplificado)

```mermaid
gantt
    title Cronograma MVP - 3 Semanas
    dateFormat  YYYY-MM-DD
    axisFormat %d/%m

    section Semana 1: Fundaciones y Cotizaciones
    Autenticación                    :a1, 2026-07-06, 5d
    Perfiles (Solicitante/Importador):a2, after a1, 3d
    Formulario Cotización            :a3, after a2, 4d
    Selección Modalidad              :a4, after a3, 2d
    Directorio Importadores          :a5, after a4, 2d

    section Semana 2: Red y Órdenes
    Distribución Cotizaciones Abiertas :b1, after a5, 3d
    Panel Propuestas Recibidas         :b2, after b1, 3d
    Conexión con Importador Elegido    :b3, after b2, 2d
    Módulo de Órdenes                  :b4, after b3, 3d
    Notificaciones                     :b5, after b4, 2d

    section Semana 3: Chat y Pulido
    Chat en Tiempo Real                :c1, after b5, 3d
    Repositorio Documentos             :c2, after c1, 2d
    Pruebas con Importadores Piloto    :c3, after c2, 2d
    Ajustes UI/UX                      :c4, after c3, 2d
```

---

## Mapa de métricas y KPIs

```mermaid
graph TD
    subgraph Metricas["Metricas de exito del MVP"]
        M1[Número de cotizaciones por modalidad]
        M2[Tasa de respuesta de importadores]
        M3[Tiempo promedio primera oferta]
        M4[Tasa conversión cotización → orden]
        M5[Importadores activos en la red]
    end

    subgraph Fuentes["Fuentes de datos"]
        F1[Backend: API logs]
        F2[MySQL: Tablas cotizaciones]
        F3[MySQL: Tabla importadores]
        F4[Wompi: Webhooks de pago]
    end

    M1 --> F2
    M2 --> F2
    M3 --> F2
    M4 --> F2
    M5 --> F3
    F4 --> M4