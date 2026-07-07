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

    E --> O
    E --> P

    F --> O

    G --> P

    H --> Q

    I --> P

    J --> O
    J --> P
    J --> Q

    K --> P
    K --> Q

    L --> Q

    M --> O
    M --> P
    M --> Q

    N --> O
    N --> P
    N --> Q

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

    E --> R[Checkout Wompi]
    E --> S[Webhooks de confirmación]

    F --> T[Chat 1 a 1 por orden]
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

## Mapa de flujo de datos del negocio

```mermaid
graph LR
    A[Solicitante] --> B[Nueva Cotización]
    B --> C{Modalidad}
    C -->|Dirigida| D[Importador específico]
    C -->|Abierta| E[Todos los importadores de la red]
    D --> F[Cotización formal del importador]
    E --> G[Propuestas múltiples]
    F --> H[Solicitante acepta/rechaza]
    G --> I[Solicitante elige mejor propuesta]
    H -->|Acepta| J[Checkout Wompi]
    I --> J
    J --> K[Pago confirmado]
    K --> L[Cotización → Orden]
    L --> M[Seguimiento de orden]
    M --> N[Chat con asesor]
```

---

## Mapa de flujo de datos del negocio (Importador)

```mermaid
graph TD
    A[Empresa Importadora] --> B[Registro en plataforma]
    B --> C[Definir perfil: países, categorías, capacidad]
    C --> D[Recibe notificaciones]
    D --> E{Tipo de solicitud}
    E -->|Dirigida| F[Solicitud exclusiva del importador]
    E -->|Abierta| G[Solicitud compartida con la red]
    F --> H[Responder cotización: precio, tiempo, condiciones]
    G --> H
    H --> I[Solicitante acepta oferta]
    I --> J[Pago confirmado por plataforma]
    J --> K[Cotización → Orden]
    K --> L[Gestión de orden desde panel importador]
    L --> M[Chat con solicitante]
```

---

## Mapa de estados de una cotización/orden

```mermaid
stateDiagram-v2
    [*] --> Cotizacion_Creada: Solicitante envía formulario
    Cotizacion_Creada --> Cotizacion_Dirigida: Modalidad dirigida
    Cotizacion_Creada --> Cotizacion_Abierta: Modalidad abierta

    Cotizacion_Dirigida --> Importador_Respondiendo: Importador recibe solicitud
    Cotizacion_Abierta --> Importadores_Recibiendo: Todos los importadores de la red reciben

    Importador_Respondiendo --> Propuesta_Pendiente: Esperando respuesta del solicitante
    Importadores_Recibiendo --> Varios_Importadores_Responden: Múltiples importadores responden

    Propuesta_Pendiente --> Solicitante_Evalua: Solicitante evalúa propuesta
    Varios_Importadores_Responden --> Solicitante_Evalua: Solicitante compara propuestas

    Solicitante_Evalua --> Checkout_Pago: Solicitante acepta oferta
    Solicitante_Evalua --> Cotizacion_Cerrada: Solicitante rechaza

    Checkout_Pago --> Pago_Confirmado: Wompi confirma pago (webhook)
    Pago_Confirmado --> Orden_Activa: Cotización se convierte en orden

    Orden_Activa --> En_Produccion: Importador confirma fabricación
    En_Produccion --> Transito_Internacional: Salida de fábrica/puerto origen
    Transito_Internacional --> Aduana_Nacionalizacion: Proceso de importación en país destino
    Aduana_Nacionalizacion --> Bodega_Local: Producto recibido en bodega del importador
    Bodega_Local --> Entregado: Cierre de la orden

    Entregado --> [*]
```

---

## Mapa de roles y permisos

```mermaid
graph TD
    A[Roles del Sistema] --> B[Solicitante]
    A --> C[Importador]
    A --> D[Admin Plataforma]

    B --> B1[Crear cotizaciones]
    B --> B2[Ver órdenes propias]
    B --> B3[Chat con asesores]
    B --> B4[Pagar ofertas aceptadas]
    B --> B5[Ver panel de propuestas (modalidad abierta)]

    C --> C1[Recibir solicitudes dirigidas]
    C --> C2[Recibir solicitudes abiertas (según perfil)]
    C --> C3[Responder cotizaciones con propuesta]
    C --> C4[Gestionar órdenes propias]
    C --> C5[Chat con solicitantes asignados]
    C --> C6[Editar perfil de empresa]

    D --> D1[Ver todas las cotizaciones abiertas]
    D --> D2[Mediar en disputas]
    D --> D3[Gestionar importadores vinculados]
    D --> D4[Monitorear métricas del sistema]
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