# Resumen ejecutivo — Zarpi

> **Fecha:** 2026-10-01

## Qué es

**Zarpi** es una plataforma que conecta a personas y empresas que quieren importar productos con **empresas importadoras** que se los traen. El cliente pide una cotización de dos formas:

- **Dirigida:** a una empresa concreta que elige del catálogo.
- **Abierta:** la plataforma la reparte sola entre las importadoras que trabajan ese país y esa categoría, y el cliente compara sus propuestas.

Ese flujo dual es el diferenciador frente a los canales actuales: catálogos estáticos, WhatsApp o contacto uno a uno.

## Dónde estamos (2026-10-01)

- **En producción** desde el 2026-10-01, con dominio propio y HTTPS.
- **Producto completo de punta a punta:**
  - cotización → propuesta → negociación por chat con calculadora de precios → orden → seguimiento → reseña;
  - documentos, cursos, centro de ayuda y soporte por niveles;
  - panel de administración con respaldos.
- **Construido en 3 meses** (5 de julio → 1 de octubre de 2026) en 22 PRs integrados: 201 operaciones de API y 656 tests automáticos verdes.
- **Seguridad revisada:** auditorías y OWASP ~92/100 en julio; carga probada con 1000 usuarios concurrentes.

## Modelo de negocio vigente

- El **solicitante no paga** por cotizar.
- **Las importadoras pagan** por contrato o suscripción, a cambio de un canal de demanda calificada.
- Herramientas que hacen valer esa suscripción:
  - límite diario de cotizaciones para no saturar a su equipo;
  - calculadora de precios en el chat;
  - asesores con reparto de cotizaciones;
  - tiers que filtran a los clientes por trayectoria.

## Qué sigue

1. **Validar el MVP (oct → dic 2026).** Conversión cotización → orden > 25 %, al menos 3 importadoras activas, respuesta en menos de 48 h y 10 órdenes entregadas en el primer mes.
2. **Cerrar la operación.** Correo transaccional, backups automáticos con copia externa y pruebas de restauración.
3. **Mediano plazo.** Instalación nativa con integración continua, suscripción premium para importadoras y expansión de categorías.

Detalle en [[Hoja-de-Ruta]].

## Para profundizar

| Tema | Nota |
|------|------|
| Estado técnico por módulo | [[Estado-del-proyecto]] |
| Cómo se construyó, con fechas | [[Cronologia-del-Proyecto]] |
| Propuesta original | [[Propuesta_Plataforma_Importacion]] |
| Pitch y mercado | [[Pitch-Inversionistas]] |
| Métricas del MVP | [[Metricas-MVP]] |
