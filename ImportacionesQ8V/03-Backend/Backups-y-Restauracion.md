# Backups, restauración y actualizaciones

> Scripts (en `proyecto/backend/scripts/`): `backup.py`, `restaurar_backup.py`, `backup_servidor.sh`, `restaurar_servidor.sh`.
> Servicio: `services/backup_service.py`. Panel admin: `GET /admin/backup`.

## Desde el panel de administración (lo habitual)

**Admin → Certificaciones (Sellos y respaldo) → Copia de seguridad.**

1. **Descargar copia de seguridad.** Baja un ZIP con toda la base de datos y, si se marca, los archivos subidos. Guárdalo fuera del servidor: en tu equipo, en una nube o en un disco externo.
2. **Restaurar una copia.** Arrastra ese ZIP a la zona de carga, o haz clic para elegirlo. El servidor lo verifica y muestra, **sin cambiar nada**:
   - fecha y versión del esquema de la copia;
   - filas por tabla, ahora y después de restaurar (solo las que cambian, o todas);
   - avisos: copia de otra versión, tablas que ya no existen, que la copia no traiga archivos, o que tu cuenta no esté en la copia.
3. Escribe **RESTAURAR** y confirma. Pasos:
   1. La plataforma entra en **mantenimiento**: la API responde 503 a todo lo demás, incluidos los demás workers.
   2. Guarda sola el estado actual en `backups/antes-de-restaurar/`.
   3. Reemplaza los datos y verifica que cada tabla tenga las filas de la copia.
   4. Rehace en Redis el reparto de las cotizaciones abiertas que siguen vigentes.
   5. Sale de mantenimiento, también si algo falla.
4. **Deshacer.** La lista "Estados anteriores a cada restauración" permite descargar cada estado guardado o **volver a él** con el mismo flujo de vista previa y confirmación.

Detalles:

- El ZIP subido queda en `backups/subidas/` hasta restaurarlo, descartarlo o 24 h como máximo.
- Tamaño máximo de subida: `MAX_BACKUP_UPLOAD_BYTES`, 2 GB por defecto.
- Solo se aceptan ZIPs de la plataforma: formato, CRC, conteos del manifiesto y rutas dentro de `uploads/` y `generated_docs/`. Un ZIP con rutas como `../../` se rechaza.
- Si tu cuenta no existe en la copia, al terminar el panel te manda a iniciar sesión con un admin que sí esté en ella.

API: `POST /admin/backup/restaurar/validar` (multipart, campo `archivo`) → `POST /admin/backup/restaurar/{subida_id}` con `{"confirmacion": "RESTAURAR", "incluir_archivos": true}`. También: `DELETE /admin/backup/restaurar/{subida_id}`, `GET /admin/backup/previos`, `GET /admin/backup/previos/{nombre}` y `POST /admin/backup/previos/{nombre}/preparar`.

> El ZIP del panel no incluye Redis ni el `.env`; por eso la restauración rehace el reparto de cotizaciones abiertas desde la base. Para recuperar el servidor completo (otro droplet, `down -v`) están los scripts de abajo.

---

## Qué se respalda en el servidor (scripts)

`backup_servidor.sh` deja todo en `proyecto/backend/backups/`, una carpeta **del host** montada en el backend como `/app/backups`. No es un volumen de Docker, así que sobrevive a `docker compose down -v`.

| Archivo | Contenido | Para qué |
|---------|-----------|----------|
| `importacionesq8-backup-*.zip` + `.sha256` | Todas las tablas en NDJSON + `uploads/` + `generated_docs/` + manifiesto con conteos y revisión de Alembic | **Copia principal.** Portable: se restaura en Docker, en instalación nativa o en otro motor. Es la que usan `restaurar_servidor.sh` y la CI |
| `mysql/mysql-*.sql.gz` + `.sha256` | `mysqldump --single-transaction` | Segunda vía con herramientas estándar (`gunzip \| mysql`), sin depender del código |
| `redis/redis-*.rdb` | Snapshot de Redis | Reparto de cotizaciones abiertas (72 h), sesiones revocadas. Sin él, tras `down -v` las empresas no pueden responder las abiertas en curso (matching estricto en producción) |
| `env/env-*` | Copia del `.env` (permisos 600) | Secretos y configuración |
| `antes-de-restaurar/` | Copia automática previa a cada restauración | Deshacer una restauración |

No hace falta respaldar los certificados de Caddy: se vuelven a pedir solos.

Todos los backups se **verifican** al crearse: suma SHA-256, CRC de cada entrada y conteo de filas contra el manifiesto. Si una tabla no se pudo leer, el backup falla en lugar de quedar incompleto. Al restaurar se verifica otra vez **antes** de borrar nada y, al terminar, se comparan los conteos de cada tabla con el manifiesto.

---

## Configuración en el droplet (una vez)

```bash
cd /opt/zarpi/proyecto/backend
bash scripts/backup_servidor.sh          # primera prueba manual
crontab -e
```

Línea del cron (todos los días a las 3:17, hora del servidor):

```
17 3 * * * cd /opt/zarpi/proyecto/backend && bash scripts/backup_servidor.sh >> /var/log/zarpi-backup.log 2>&1
```

Variables opcionales en `.env`:

| Variable | Por defecto | Uso |
|----------|-------------|-----|
| `BACKUP_RETENCION` | `14` | Copias de cada tipo que se conservan en el servidor |
| `BACKUP_REMOTO` | vacío | Destino de `rclone` para la copia externa (ej. `spaces:zarpi-backups/produccion`) |
| `BACKUP_REMOTO_INCLUIR_ENV` | `false` | Subir también las copias del `.env` |

### Copia externa (recomendada)

Sin ella, si se pierde el droplet se pierden también los backups. Con DigitalOcean Spaces (compatible con S3):

1. En DigitalOcean, crea un Space privado y una llave de acceso (API → Spaces Keys).
2. En el droplet: `apt install -y rclone && rclone config`. Crea un remoto `spaces` de tipo **s3**, proveedor **DigitalOcean**, con la llave y el endpoint de la región (ej. `nyc3.digitaloceanspaces.com`).
3. En `.env`: `BACKUP_REMOTO=spaces:nombre-del-space/produccion`.

Se usa `rclone copy` (no `sync`): borrar algo en el servidor no lo borra del remoto. La retención del remoto se configura en el propio Space (Lifecycle rules).

---

## Actualizar la aplicación

### Actualización normal (sin tocar volúmenes)

Las migraciones de Alembic corren solas al arrancar el backend.

```bash
cd /opt/zarpi/proyecto/backend
bash scripts/backup_servidor.sh
git pull
docker compose up -d --build
```

Si algo sale mal, se vuelve al código anterior (`git checkout <commit>` + `docker compose up -d --build`) y, si la base quedó afectada, se restaura (ver abajo).

### Actualización recreando los volúmenes (`down -v`)

Para empezar con volúmenes limpios: cambio de versión de MySQL, base corrupta o una migración que no aplica sobre la base actual.

```bash
cd /opt/zarpi/proyecto/backend

# 1. Backup completo y verificado. Anota los nombres que imprime.
bash scripts/backup_servidor.sh
ls -1t backups/importacionesq8-backup-*.zip | head -1
ls -1t backups/redis/redis-*.rdb | head -1

# 2. Código nuevo
git pull

# 3. Tirar contenedores Y volúmenes (borra MySQL, Redis, uploads)
docker compose down -v

# 4. Construir y levantar SOLO el backend (arrastra MySQL y Redis).
#    El frontend (Caddy) queda apagado: nadie entra a una base vacía.
#    El backend crea el esquema actual al arrancar con la base vacía.
docker compose build
docker compose up -d backend

# 5. Restaurar datos, archivos y Redis. Al terminar, el script reabre el sitio.
bash scripts/restaurar_servidor.sh backups/importacionesq8-backup-AAAAMMDD-HHMMSS.zip \
     --redis backups/redis/redis-AAAAMMDD-HHMMSS.rdb
```

`restaurar_servidor.sh` verifica el ZIP, pide escribir `RESTAURAR`, corta el tráfico, restaura, comprueba los conteos, reinicia el backend, espera `/health/ready` y solo entonces vuelve a levantar Caddy. Si algo falla, el sitio **queda cerrado** a propósito, para que no entren escrituras sobre datos a medias.

El backup puede ser de una versión anterior del esquema: se carga sobre las tablas del código nuevo, ignorando columnas que ya no existen y usando los valores por defecto en las nuevas.

---

## Recuperación ante desastre (droplet nuevo)

1. Sigue la guía de despliegue hasta tener el `.env` (puedes partir de `env/env-*` del backup).
2. Trae los backups del remoto: `rclone copy spaces:zarpi-backups/produccion backups/`
3. Ejecuta los pasos 4 y 5 de "Actualización recreando los volúmenes".

---

## Migración a instalación nativa e integración continua

El ZIP portable no depende de Docker ni de MySQL: `backup.py` y `restaurar_backup.py` son Python puro sobre SQLAlchemy y usan `DATABASE_URL`.

**Migración**

1. En Docker: `bash scripts/backup_servidor.sh`.
2. En el servidor nativo (venv con `requirements.txt` y MySQL/Redis instalados), con `DATABASE_URL` apuntando a la base nueva **vacía**:
   ```bash
   python scripts/restaurar_backup.py importacionesq8-backup-....zip                         # simulacro
   python scripts/restaurar_backup.py importacionesq8-backup-....zip --crear-esquema --aplicar
   ```
   Los archivos se restauran en `uploads/` y `generated_docs/` junto al backend.
3. Redis: copia `redis-*.rdb` como `dump.rdb` en el `dir` de Redis con el servicio detenido, y arráncalo.

**Paso de la CI antes de desplegar** (aborta si el backup falla):

```bash
python scripts/backup.py --destino /var/backups/zarpi --retener 30 || exit 1
# … desplegar …
```

`backup.py --verificar <zip>` sirve para comprobar en la CI que la copia externa se puede leer.

---

## Probar la restauración

Un backup que nunca se restauró no está probado. Una vez al mes, restaura el último ZIP en una base aparte con la instalación nativa o un MySQL temporal, usando `--crear-esquema --aplicar`, y confirma que termine con "todas las tablas tienen las mismas filas que el backup". La suite incluye ese ciclo con SQLite (`tests/test_backup_cli.py::TestCicloCompleto`).
