#!/usr/bin/env bash
# Restaura en el servidor (Docker) un backup hecho con scripts/backup_servidor.sh.
#
#   bash scripts/restaurar_servidor.sh backups/importacionesq8-backup-AAAAMMDD-HHMMSS.zip \
#        [--redis backups/redis/redis-AAAAMMDD-HHMMSS.rdb] [--si]
#
# Qué hace, en orden:
#   1. Verifica el ZIP (suma SHA-256, CRC y conteos) antes de tocar nada.
#   2. Saca una copia de seguridad del estado ACTUAL (por si hay que deshacer).
#   3. Detiene Caddy: nadie escribe en la base mientras se restaura.
#   4. Restaura base de datos + uploads/ + generated_docs/ y comprueba que cada
#      tabla tenga las mismas filas que el backup.
#   5. Con --redis, repone el snapshot de Redis.
#   6. Reinicia el backend, comprueba /health/ready y vuelve a abrir el tráfico.
#
# Sirve tanto para deshacer una actualización como para recuperar el servidor
# tras `docker compose down -v` (ver la guía de backups).
set -euo pipefail
cd "$(dirname "$0")/.."

uso() {
  echo "Uso: bash scripts/restaurar_servidor.sh backups/importacionesq8-backup-....zip [--redis backups/redis/redis-....rdb] [--si]" >&2
  exit 1
}
log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

ZIP=""; RDB=""; CONFIRMADO=false
while [ $# -gt 0 ]; do
  case "$1" in
    --redis) RDB=${2:-}; [ -n "$RDB" ] || uso; shift 2 ;;
    --si) CONFIRMADO=true; shift ;;
    -h|--help) uso ;;
    *) [ -z "$ZIP" ] || uso; ZIP=$1; shift ;;
  esac
done
[ -n "$ZIP" ] || uso
[ -f "$ZIP" ] || { echo "No existe $ZIP" >&2; exit 1; }
[ -z "$RDB" ] || [ -f "$RDB" ] || { echo "No existe $RDB" >&2; exit 1; }

# El backend solo ve ./backups (montado en /app/backups). Si el ZIP viene de
# otro sitio (descargado del panel, traído del remoto), se copia ahí primero.
mkdir -p backups
NOMBRE=$(basename "$ZIP")
if [ "$(cd "$(dirname "$ZIP")" && pwd)" != "$(pwd)/backups" ]; then
  cp "$ZIP" "backups/$NOMBRE"
  [ -f "$ZIP.sha256" ] && cp "$ZIP.sha256" "backups/$NOMBRE.sha256"
fi
EN_CONTENEDOR="/app/backups/$NOMBRE"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx backend; then
  echo "El backend no está corriendo. Levántalo primero (sin el frontend, para no abrir el tráfico):" >&2
  echo "  docker compose up -d backend" >&2
  exit 1
fi

log "1/6 Verificando $NOMBRE"
docker compose exec -T backend python scripts/backup.py --verificar "$EN_CONTENEDOR"

echo
echo "Se va a REEMPLAZAR la base de datos actual por el contenido de $NOMBRE"
[ -n "$RDB" ] && echo "y el estado de Redis por $(basename "$RDB")"
echo "El sitio quedará fuera de servicio durante la restauración."
if [ "$CONFIRMADO" != true ]; then
  read -r -p "Escribe RESTAURAR para continuar: " respuesta
  [ "$respuesta" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
fi

log "2/6 Copia de seguridad del estado actual (para poder deshacer)"
# --retener 0: esta copia no debe disparar la rotación y borrar otra.
docker compose exec -T backend python scripts/backup.py --destino /app/backups/antes-de-restaurar --retener 0 \
  || log "    Aviso: no se pudo copiar el estado actual (¿base vacía tras down -v?). Se continúa."

log "3/6 Cortando el tráfico (deteniendo Caddy)"
docker compose stop frontend 2>/dev/null || true

reabrir() { log "Reabriendo el tráfico"; docker compose up -d frontend >/dev/null; }
trap 'echo "La restauración FALLÓ. El sitio sigue cerrado para que no entren escrituras sobre datos a medias." >&2; echo "Revisa el error, y cuando quieras reabrir: docker compose up -d frontend" >&2' ERR

log "4/6 Restaurando base de datos y archivos"
docker compose exec -T backend python scripts/restaurar_backup.py "$EN_CONTENEDOR" --aplicar

if [ -n "$RDB" ]; then
  log "5/6 Reponiendo Redis desde $(basename "$RDB")"
  chmod 644 "$RDB"
  docker compose stop redis
  docker compose cp "$RDB" redis:/data/dump.rdb
  docker compose start redis
else
  log "5/6 Redis: sin --redis, se conserva el estado actual"
fi

log "6/6 Reiniciando backend y comprobando salud"
docker compose restart backend >/dev/null
for _ in $(seq 1 30); do
  if docker compose exec -T backend python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health/ready', timeout=3).status == 200 else 1)" 2>/dev/null; then
    trap - ERR
    reabrir
    log "Restauración completada y sitio en línea."
    exit 0
  fi
  sleep 2
done
echo "El backend no respondió /health/ready tras restaurar. El sitio sigue cerrado: revisa 'docker compose logs backend'." >&2
exit 1
