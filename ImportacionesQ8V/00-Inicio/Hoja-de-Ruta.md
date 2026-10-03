# Hoja de ruta y metas

> **Última actualización:** 2026-10-03 · Zarpi está en producción desde el **2026-10-01**.
> Las metas de negocio son las que el equipo fijó en [[Metricas-MVP]] y [[Modelo-Negocio]], ancladas a la fecha real de lanzamiento. Las fechas objetivo son una **propuesta** para revisar y ajustar en equipo.

---

## 1. Metas de negocio del lanzamiento

### Ventana de validación del MVP: octubre → diciembre de 2026

Criterios de decisión de [[Metricas-MVP]]:

| Criterio "Go" (continuar e invertir) | Meta | Estado |
|--------------------------------------|------|--------|
| Conversión cotización → orden | > 25 % | ⬜ Se mide desde el lanzamiento |
| Importadores activos que responden con regularidad | ≥ 3 | ⬜ |
| Tiempo promedio de respuesta | < 48 h | ⬜ |
| Órdenes completadas (entregadas) en el primer mes | ≥ 10 | ⬜ |

| Señal de "No-Go" (reevaluar el modelo) | Umbral |
|----------------------------------------|--------|
| Conversión cotización → orden | < 15 % |
| Importadores activos tras el MVP | < 2 |
| Tiempo promedio de respuesta | > 7 días |
| Cotizaciones sin ninguna propuesta | > 80 % |

### Tracción mensual objetivo

| Métrica | Meta MVP |
|---------|----------|
| Importadores activos | 5–10 (retención mes 2 > 70 %) |
| Cotizaciones por mes | 50–100, con mezcla dirigida/abierta entre 40 y 60 % |
| Órdenes por mes | 15–30 |
| Respuesta a cotizaciones abiertas | > 60 % en 48 h, > 80 % en 72 h |
| Compradores nuevos por mes | 20–50 (registro → primera cotización > 40 %) |

**Cómo medirlo con la plataforma:**
- **Bitácora de eventos** (tabla `eventos`, desde el 2026-10-03): guarda cada solicitud, asignación, vista, propuesta, elección (con motivo) e hito de pedido, con fecha, monto en pesos y cantidad. Cualquier métrica de esta tabla se puede calcular sobre ella; ver [[24-Eventos-y-Panel-Empresa]].
- **Empresas:** ven su rendimiento en su panel (`GET /importadores/panel`).
- **Admin:** *Resumen* y `GET /admin/metricas` dan los conteos generales. Conviene registrar la línea base de cada métrica el primer lunes de cada mes en esta nota.

### Estrategia por etapas ([[Modelo-Negocio]])

| Etapa | Ventana propuesta | Foco |
|-------|-------------------|------|
| 1 — Lanzamiento (meses 1–6) | oct 2026 → mar 2027 | 2–3 importadores piloto, una categoría foco (p. ej. Textiles), construir reputación |
| 2 — Crecimiento (meses 7–18) | abr 2027 → mar 2028 | Más categorías e importadores, suscripción premium para importadoras |
| 3 — Escalamiento (meses 19–36) | abr 2028 → sep 2029 | Nuevos países (Ecuador, Perú…), servicios adicionales, evaluar Serie A |

> ⚠️ **Decisión de negocio por reflejar en los documentos.** Desde el 2026-07-20 **no se cobra al solicitante**: el ingreso viene de las empresas importadoras, por contrato o suscripción (`COBRO_A_SOLICITANTES=false`). [[Modelo-Negocio]] y [[Pitch-Inversionistas]] todavía describen una comisión por orden. El equipo de negocio debe actualizarlos.

---

## 2. Pendientes técnicos y operativos

### P0 — Antes de recibir clientes reales (octubre de 2026)

- [ ] **Correo transaccional:** poner `SMTP_API_KEY` de Resend en el `.env` de producción. Sin ella no llegan los códigos OTP y nadie puede registrarse.
- [ ] **Backups automáticos:**
  - cron diario de `scripts/backup_servidor.sh`;
  - copia externa (`BACKUP_REMOTO`, DigitalOcean Spaces);
  - una restauración de prueba. Ver [[Backups-y-Restauracion]].
- [ ] **Primer admin y credenciales:** crear el admin con `scripts/crear_admin.py` y verificar que no quedan contraseñas por defecto.
- [ ] **DNS de `www`:** crear el registro, o quitar el bloque `www.` del `Caddyfile`, para que Caddy no reintente el certificado.
- [ ] **Pagos:** decidir si Wompi se usa en esta etapa (cursos de pago). Mientras tanto, `WOMPI_SIMULATE=true`.
- [ ] **TRM en producción:**
  - comprobar que el droplet llega a `www.datos.gov.co` (en **Admin › Asignación**, la TRM debe decir "TRM oficial del día");
  - fijar un valor de respaldo.
- [ ] **Asignación del piloto:**
  - pedir a cada empresa su pedido mínimo y capacidad en **Mi empresa**;
  - revisar cada mañana las solicitudes "Por asignar".

### P1 — Primeros dos meses (oct → nov 2026)

- [ ] **Tests de lo que hoy no tiene:**
  - correos masivos (se marcó "Validation Pending");
  - CMS de la landing;
  - validación del rol en el login.
- [ ] **Notificaciones en vivo:** el frontend todavía no consume `GET /notificaciones/stream` (SSE); hoy refresca por sondeo.
- [ ] **Cupo diario visible en el catálogo:** que el cliente vea que una empresa agotó su cupo antes de llenar la cotización, no solo al enviarla.
- [ ] **Probar con un asesor** la calculadora y "Convertir en propuesta" (la prueba de punta a punta se hizo con la cuenta dueña).
- [ ] **Coherencia de marca en el vault:** las notas vivas aún dicen ImportacionesQ8. Las notas históricas se dejan como están.
- [ ] **Actualizar los documentos de negocio** con el modelo de cobro vigente (ver arriba).
- [ ] **Automatizar la asignación** con los datos del piloto: calibrar el puntaje de encaje y pasar a modo automático. Ver [[23-Asignacion-de-Solicitudes]].
- [ ] **Cantidad en el formulario de propuesta:** el API ya acepta `cantidad`; hoy se toma la pedida.
- [ ] **Chat con varias empresas en una abierta:** hoy el hilo es uno por cotización. Decidir con el piloto si cada empresa asignada necesita el suyo.

### P2 — Mediano plazo (dic 2026 → mar 2027)

- [ ] **Migración a instalación nativa con integración continua.** Es una meta declarada del equipo. Pasos:
  1. Pipeline de CI que corra tests y build del frontend.
  2. Despliegue automático tras merge a `main`.
  3. Servicios systemd (uvicorn, Caddy) con MySQL y Redis nativos.
  4. Migración de datos con el ZIP portable (`restaurar_backup.py --crear-esquema --aplicar`).

  Ver la sección de migración en [[Backups-y-Restauracion]].
- [ ] **CI del frontend:** hoy la CI solo cubre el backend. Hay 88 errores de TypeScript previos que impiden poner `tsc` como verificación; el build de Vite sí pasa.
- [ ] **Dividir `App.tsx`** (unas 11 000 líneas) por pantallas, para que los cambios sean más seguros y revisables.
- [ ] **Suscripción premium para importadoras** (etapa 2 del modelo de negocio).

---

## 3. Cómo mantener esta nota

- Marca las casillas al completar cada punto y anota la fecha.
- Cada mes, registra los valores reales de las métricas del apartado 1.
- Lo terminado pasa a la nota de fase correspondiente en [[Indice-Historial]].

← [[Estado-del-proyecto]] · [[Inicio]]
