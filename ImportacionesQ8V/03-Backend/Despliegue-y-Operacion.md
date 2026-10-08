# Despliegue y operación en producción

> **Última actualización:** 2026-10-03 · En producción desde el 2026-10-01 en un droplet de DigitalOcean.
> Archivos: `proyecto/backend/docker-compose.yml` + `docker-compose.prod.yml`, `proyecto/frontend/Caddyfile`, `proyecto/frontend/Dockerfile.prod`, `proyecto/backend/.env.production.example`, `proyecto/backend/scripts/`.

## Arquitectura de producción

```text
Internet ──► :80 / :443 ──► Caddy (contenedor "frontend")
                              ├─ /           → SPA compilada (Vite) servida por Caddy
                              └─ /api/*      → backend:8000 (FastAPI, red interna)
                                                 ├─ mysql:3306  (red interna)
                                                 └─ redis:6379  (red interna)
```

- **Caddy es el único servicio con puertos públicos.** Pide y renueva solo el certificado HTTPS de Let's Encrypt para `DOMINIO` y `www.DOMINIO`.
- **Backend, MySQL y Redis no publican puertos.** Docker se salta `ufw` en los puertos que publica, así que la única barrera real es no publicarlos.
- En un droplet no hay router ni NAT: la IP pública está en la máquina. El "port forwarding" lo hace Docker al publicar `80:80` y `443:443`.
- La configuración de producción se activa con `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml` en el `.env`.

---

## Primer despliegue

1. **DNS:** registros `A` para `@` y `www` hacia la IP del droplet. Sin `AAAA`, salvo que el droplet tenga IPv6.
2. **Firewall de DigitalOcean** (Networking → Firewalls): permitir entrada TCP 22, 80 y 443, y UDP 443.
3. **Preparar el servidor:**
   ```bash
   apt update && apt -y upgrade
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab        # el build del frontend necesita memoria
   curl -fsSL https://get.docker.com | sh                  # Compose >= 2.24
   systemctl disable --now nginx apache2 2>/dev/null || true
   ```
4. **Código:**
   ```bash
   git clone https://github.com/JuanEstebanAstaiza/ImportacionesQ8.git /opt/zarpi
   cd /opt/zarpi/proyecto/backend
   ```
5. **`.env` de producción:**
   ```bash
   bash scripts/generar_env_produccion.sh tudominio.com
   ```
   - El script genera los secretos (JWT, MySQL, Redis, Wompi events) y no sobrescribe un `.env` existente.
   - A mano, edita `SMTP_API_KEY` (Resend), `SMTP_FROM` y `CONTACT_EMAIL`, y las llaves de Wompi si aplica.
6. **Levantar:** `docker compose up -d --build`. Las migraciones de Alembic corren solas en `entrypoint.sh`.
7. **Verificar:**
   ```bash
   bash scripts/diagnostico_despliegue.sh
   curl https://tudominio.com/api/health
   ```
8. **Primer administrador:**
   ```bash
   docker compose exec backend python scripts/crear_admin.py admin@tudominio.com
   ```

> ⚠️ **Contraseña de MySQL.** MySQL solo toma la contraseña al crear su volumen por primera vez. Si regeneras el `.env` sobre una base existente, copia antes `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` y `REDIS_PASSWORD` del `.env` anterior.

## Actualizar

```bash
cd /opt/zarpi/proyecto/backend
bash scripts/backup_servidor.sh        # siempre antes de actualizar
git pull
docker compose up -d --build
```

Para actualizar recreando los volúmenes (`down -v`), sigue el procedimiento de [[Backups-y-Restauracion]].

## Scripts de operación (`proyecto/backend/scripts/`)

| Script | Para qué | Dónde se ejecuta |
|--------|----------|------------------|
| `generar_env_produccion.sh <dominio>` | `.env` de producción con secretos nuevos | Host |
| `diagnostico_despliegue.sh` | Revisa versión de Compose, `.env`, puertos 80/443, servicios que los ocupan, `ufw`, DNS frente a la IP, HTTP/HTTPS locales y logs de Caddy | Host |
| `crear_admin.py <email>` | Crea o promueve la cuenta admin (pide la contraseña) | `docker compose exec backend …` |
| `backup_servidor.sh` | Backup completo (ZIP portable + `mysqldump` + Redis + `.env`), pensado para cron | Host |
| `restaurar_servidor.sh <zip> [--redis <rdb>]` | Restauración guiada con modo mantenimiento y verificación | Host |
| `backup.py` / `restaurar_backup.py` | Backup y restauración portables (Docker o nativo) | Backend |

## Problemas conocidos y solución

| Síntoma | Causa | Solución |
|---------|-------|----------|
| El dominio resuelve a la IP pero la web no carga; `docker compose ps` no muestra `0.0.0.0:80->80` (incidente del 2026-10-01) | Se levantó la configuración de **desarrollo**: el `.env` no tenía `COMPOSE_FILE` y se publicaron 5173/8000 en lugar de 80/443 | Añadir `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml` y `COMPOSE_PATH_SEPARATOR=:` al `.env`, luego `docker compose down && docker compose up -d --build` |
| `frontend` se reinicia en bucle | Falta `DOMINIO` o falla el certificado | `docker compose logs frontend` |
| Error al publicar el puerto 80 | Un nginx o apache del host ocupa el puerto | `systemctl disable --now nginx apache2` |
| Error con `!reset` / `!override` | Docker Compose anterior a 2.24 | Reinstalar con `get.docker.com` |
| Todo verde en el droplet pero no carga desde fuera | Firewall de DigitalOcean | Abrir 80/443 en Networking → Firewalls |
| El backend no conecta a MySQL tras regenerar el `.env` | Contraseña distinta a la del volumen existente | Restaurar las contraseñas anteriores o recrear el volumen con un backup |

## Variables de entorno clave de producción

| Variable | Uso |
|----------|-----|
| `DOMINIO`, `CORS_ORIGINS`, `FRONTEND_URL` | Dominio del sitio, orígenes permitidos y base de los enlaces en los correos |
| `COMPOSE_FILE`, `COMPOSE_PATH_SEPARATOR` | Activan la configuración de producción |
| `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES=1440` | JWT. El frontend no renueva el token, por eso dura 24 h |
| `SMTP_*` (Resend), `CONTACT_EMAIL` | Correo transaccional y formulario de contacto |
| `WOMPI_SIMULATE`, `WOMPI_*` | Pagos (simulados mientras no haya llaves reales) |
| `BACKUP_RETENCION`, `BACKUP_REMOTO`, `MAX_BACKUP_UPLOAD_BYTES` | Backups. Ver [[Backups-y-Restauracion]] |
| `CUPO_COTIZACIONES_UTC_OFFSET_HORAS` | Zona horaria del cupo diario (−5, Colombia) |
| `ASIGNACION_COTIZACIONES`, `ASIGNACION_CUPO_POR_SOLICITUD` | Valor inicial del modo de asignación de abiertas (`manual` en el piloto) y del cupo de empresas por solicitud (3). El admin los cambia luego desde el panel. Ver [[23-Asignacion-de-Solicitudes]] |
| `TRM_CONSULTA_AUTOMATICA`, `TRM_URL`, `TRM_TIMEOUT_SEGUNDOS`, `TRM_RESPALDO_COP` | TRM oficial diaria desde datos.gov.co para guardar montos en pesos. El servidor necesita salida HTTPS a `www.datos.gov.co`; si no la tiene, usa el respaldo del admin. Ver [[24-Eventos-y-Panel-Empresa]] |

← [[Indice-Backend]] · [[Estado-del-proyecto]]
