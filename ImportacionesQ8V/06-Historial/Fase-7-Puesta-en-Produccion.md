# Fase 7 — Puesta en producción y operación (2026-09-30 → 2026-10-01)

> **Última actualización:** 2026-10-01
> PRs: #22, #23, #24 y #25, de la rama `claude/zen-dirac-gp2njw`, integrados el 2026-10-01. #20 se cerró y su contenido llegó con #22; #21 se integró en la rama `feature/QoL-proveedores`.

## Objetivo de la fase

Poner la plataforma **en producción** y darle lo que necesita para operar con clientes reales:
- controlar la demanda que recibe cada empresa;
- acelerar la negociación con precios en el chat;
- poder actualizar sin miedo a perder datos.

---

## Cronología

| Fecha | Entrega | Detalle | Documentación |
|-------|---------|---------|---------------|
| 09-30 | **Límite diario de cotizaciones por empresa** | La empresa fija cuántas cotizaciones recibe por día. Al llegar al tope, las dirigidas se rechazan con 409 y las abiertas se reparten a otras empresas. El contador se reinicia a medianoche de Colombia. Tabla `recepciones_cotizacion`, migración `0024` | [[19-Limite-Diario-Cotizaciones]] |
| 09-30 | **Calculadora de precios en el chat** | La empresa calcula y envía un precio estimado: mercancía, flete, seguro, CIF, arancel, IVA, gastos y margen, con un rango posible. El servidor recalcula siempre el desglose. El WebSocket ya no acepta tipos de mensaje reservados | [[20-Calculadora-Precios-Chat]] |
| 09-30 | **Convertir estimación en propuesta** | Un botón en la tarjeta abre la propuesta formal prellenada. El formulario deja de reescribirse con cada refresco automático | [[20-Calculadora-Precios-Chat]] |
| 10-01 | **Despliegue en DigitalOcean** | Droplet con dominio propio. El problema de "puertos sin publicar" se debía a levantar la configuración de desarrollo. Se crearon `scripts/diagnostico_despliegue.sh` y `scripts/crear_admin.py` | [[Despliegue-y-Operacion]] |
| 10-01 | **Sistema de backups completo** | `scripts/backup.py` (ZIP verificado y con rotación); `backup_servidor.sh` para cron (ZIP portable + `mysqldump` + Redis + `.env`, con copia externa opcional); `restaurar_servidor.sh` | [[Backups-y-Restauracion]] |
| 10-01 | **Restaurar desde el panel** | Arrastrar el ZIP, ver una vista previa y confirmar escribiendo RESTAURAR. Modo mantenimiento, copia automática del estado previo, reconstrucción del reparto de cotizaciones abiertas y protección contra rutas maliciosas en el ZIP | [[Backups-y-Restauracion]] |
| 10-01 | **Sección "Respaldos"** en el menú del admin | La tarjeta de backup estaba escondida al final de "Certificaciones" | [[Pantallas-Admin]] |
| 10-01 | **Visibilidad del límite y la calculadora** | Tarjeta con interruptor y barra de uso en "Mi empresa"; botón "Calcular precio"; el aviso de cupo agotado ahora se ve | [[Pantallas-Importador]] |
| 10-01 | Documentación al día | Catálogo regenerado (201 operaciones), Postman, historial, estado, hoja de ruta, despliegue | Esta nota |

---

## Cómo se verificó

- **Suite de backend:** 656 tests verdes al cierre, incluido un ciclo real de respaldo y restauración sobre una base vacía (también a través de la API).
- **Scripts de servidor:** probados con un `docker` simulado. Así se encontró y corrigió un fallo que hacía terminar el cron de backup en silencio cuando faltaba una variable opcional.
- **Frontend:** recorrido en un navegador contra backend y frontend reales. Se probó activar el límite, el 409 visto por el cliente, la calculadora, la estimación vista por empresa y cliente, y la conversión en propuesta.

## Decisiones de esta fase y por qué

- **Recepciones registradas en base de datos, incluidas las omitidas por cupo.** Sin ese registro, una abierta saltada por cupo volvería a aparecer en la bandeja de la empresa.
- **El cálculo de precios solo lo hace el servidor.** Lo que la empresa ve es exactamente lo que recibe el cliente, y nadie puede colar cifras inventadas.
- **Restaurar pone la plataforma en mantenimiento (503).** Nadie escribe sobre tablas a medio recargar. Se desactiva también si algo falla.
- **Copias en una carpeta del host, no en un volumen.** Sobreviven a `docker compose down -v`, que es justo cuando hacen falta.

← [[Cronologia-del-Proyecto]] · [[Indice-Historial]]
