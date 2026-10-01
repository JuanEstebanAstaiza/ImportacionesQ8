#!/usr/bin/env bash
# Backup completo del servidor (Docker). Pensado para cron y para ejecutarlo a
# mano antes de cualquier actualización:
#
#   cd /opt/zarpi/proyecto/backend && bash scripts/backup_servidor.sh
#
# Deja en ./backups (carpeta del HOST, fuera de los volúmenes de Docker, así
# que sobrevive a `docker compose down -v`):
#
#   importacionesq8-backup-*.zip (+ .sha256)  Copia PORTABLE: tablas en NDJSON + uploads/
#                                             + generated_docs/. Es la que se restaura con
#                                             scripts/restaurar_servidor.sh y la que sirve
#                                             para migrar a una instalación nativa u otro motor.
#   mysql/mysql-*.sql.gz (+ .sha256)          mysqldump nativo: segunda vía de recuperación con
#                                             herramientas estándar, sin depender del código.
#   redis/redis-*.rdb                         Snapshot de Redis: reparto de cotizaciones abiertas
#                                             (72 h) y sesiones revocadas. Sin él, tras un
#                                             `down -v` las empresas no pueden responder las
#                                             abiertas en curso.
#   env/env-*                                 Copia del .env (secretos, permisos 600).
#
# Variables opcionales en .env:
#   BACKUP_RETENCION=14          cuántas copias de cada tipo conservar
#   BACKUP_REMOTO=spaces:bucket/zarpi   destino de rclone para la copia externa
#   BACKUP_REMOTO_INCLUIR_ENV=false     subir también las copias del .env
#
# Termina con código distinto de 0 si cualquier paso falla (cron lo registra).
set -euo pipefail
cd "$(dirname "$0")/.."

valor_env() {
  # No se hace `source .env`: valores como `SMTP_FROM=Zarpi <no-reply@...>`
  # romperían la shell. Se lee la última definición de la clave, tal cual.
  # `|| true`: con `set -e` y `pipefail`, una clave ausente (grep sin
  # coincidencias) cerraría el script en silencio sin hacer el backup.
  [ -f .env ] || return 0
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true
}

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

retener() {
  # $1 = carpeta, $2 = patrón, $3 = cuántos conservar. El nombre lleva la fecha,
  # así que el orden alfabético es el cronológico.
  local carpeta=$1 patron=$2 conservar=$3
  [ "$conservar" -ge 1 ] 2>/dev/null || return 0
  # shellcheck disable=SC2012
  ls -1 "$carpeta"/$patron 2>/dev/null | sort | head -n -"$conservar" | while read -r viejo; do
    rm -f "$viejo" "$viejo.sha256"
  done
}

[ -f .env ] || { echo "No existe .env en $(pwd)" >&2; exit 1; }

DIR=backups
RETENCION=$(valor_env BACKUP_RETENCION); RETENCION=${RETENCION:-14}
REMOTO=$(valor_env BACKUP_REMOTO)
REMOTO_ENV=$(valor_env BACKUP_REMOTO_INCLUIR_ENV)
REDIS_PASSWORD=$(valor_env REDIS_PASSWORD); REDIS_PASSWORD=${REDIS_PASSWORD:-redis_q8_dev_change_me}
MARCA=$(date -u +%Y%m%d-%H%M%S)

mkdir -p "$DIR/mysql" "$DIR/redis" "$DIR/env"
chmod 700 "$DIR"

# Dos ejecuciones a la vez (cron + manual) se pisarían los archivos.
exec 9>"$DIR/.lock"
if ! flock -n 9; then
  echo "Ya hay un backup en curso." >&2
  exit 1
fi

log "1/4 Copia portable (base de datos + archivos subidos)"
docker compose exec -T backend python scripts/backup.py --destino /app/backups --retener "$RETENCION"

log "2/4 mysqldump"
DUMP="$DIR/mysql/mysql-$MARCA.sql.gz"
# --single-transaction: copia coherente sin bloquear la aplicación (InnoDB).
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --routines --triggers --events --no-tablespaces --default-character-set=utf8mb4 "$MYSQL_DATABASE"' \
  | gzip -6 > "$DUMP.parcial"
gzip -t "$DUMP.parcial"
mv "$DUMP.parcial" "$DUMP"
( cd "$DIR/mysql" && sha256sum "$(basename "$DUMP")" > "$(basename "$DUMP").sha256" )
retener "$DIR/mysql" 'mysql-*.sql.gz' "$RETENCION"
log "    $(du -h "$DUMP" | cut -f1) en $DUMP"

log "3/4 Snapshot de Redis"
RDB="$DIR/redis/redis-$MARCA.rdb"
docker compose exec -T -e REDISCLI_AUTH="$REDIS_PASSWORD" redis redis-cli SAVE >/dev/null
docker compose cp redis:/data/dump.rdb "$RDB"
chmod 644 "$RDB"
retener "$DIR/redis" 'redis-*.rdb' "$RETENCION"
log "    $(du -h "$RDB" | cut -f1) en $RDB"

log "4/4 Copia del .env"
install -m 600 .env "$DIR/env/env-$MARCA"
retener "$DIR/env" 'env-*' "$RETENCION"

if [ -n "$REMOTO" ]; then
  if command -v rclone >/dev/null 2>&1; then
    log "Copia externa con rclone → $REMOTO"
    FILTROS=(--exclude '*.parcial' --exclude '.lock')
    [ "$REMOTO_ENV" = "true" ] || FILTROS+=(--exclude 'env/**')
    # `copy`, no `sync`: borrar algo en el servidor no debe borrarlo del remoto.
    rclone copy "$DIR" "$REMOTO" "${FILTROS[@]}"
  else
    echo "BACKUP_REMOTO está definido pero rclone no está instalado: no hay copia externa." >&2
    exit 1
  fi
else
  log "Aviso: sin BACKUP_REMOTO las copias solo viven en este servidor. Si el droplet se pierde, se pierden con él."
fi

log "Backup completo en $(pwd)/$DIR"
