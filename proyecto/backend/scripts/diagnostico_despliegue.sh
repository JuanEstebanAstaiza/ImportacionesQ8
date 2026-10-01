#!/usr/bin/env bash
# Diagnóstico del despliegue en el servidor (droplet): explica por qué el
# dominio resuelve a la IP pero la web no responde. Solo lee; no cambia nada.
#
#   cd proyecto/backend && bash scripts/diagnostico_despliegue.sh
#
# En producción el ÚNICO contenedor con puertos publicados es `frontend`
# (Caddy, 80/443). Backend, MySQL y Redis no publican nada a propósito: se
# alcanzan por la red interna de Docker. Por eso "el backend corre perfecto"
# no basta: si Caddy no está arriba con 80/443, nadie atiende al dominio.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

ok()    { printf '  \033[32m✔\033[0m %s\n' "$*"; }
falla() { printf '  \033[31m✘\033[0m %s\n' "$*"; PROBLEMAS=$((PROBLEMAS + 1)); }
aviso() { printf '  \033[33m!\033[0m %s\n' "$*"; }
titulo(){ printf '\n\033[1m%s\033[0m\n' "$*"; }
PROBLEMAS=0

titulo "1. Docker Compose"
if ! docker compose version >/dev/null 2>&1; then
  falla "No está 'docker compose' (plugin v2). Instálalo: curl -fsSL https://get.docker.com | sh"
else
  VERSION=$(docker compose version --short 2>/dev/null | sed 's/^v//')
  if printf '%s\n%s\n' "2.24.0" "$VERSION" | sort -V -C; then
    ok "docker compose $VERSION (>= 2.24, entiende !reset/!override)"
  else
    falla "docker compose $VERSION es anterior a 2.24: no entiende '!reset'/'!override' de docker-compose.prod.yml. Actualiza Docker."
  fi
fi

titulo "2. Archivo .env de producción (en $(pwd))"
if [ ! -f .env ]; then
  falla "No existe .env aquí. Créalo con: bash scripts/generar_env_produccion.sh tudominio.com"
  DOMINIO=""
else
  if grep -q '^COMPOSE_FILE=.*docker-compose.prod.yml' .env; then
    ok "COMPOSE_FILE incluye docker-compose.prod.yml"
  else
    falla "Falta COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml en .env: 'docker compose up' levanta la config de DESARROLLO (puertos 5173/8000, sin 80/443)."
  fi
  DOMINIO=$(grep -E '^DOMINIO=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')
  if [ -n "$DOMINIO" ]; then ok "DOMINIO=$DOMINIO"; else falla "Falta DOMINIO en .env: Caddy no arranca sin él."; fi
fi

titulo "3. Configuración que Compose va a usar"
if docker compose config 2>/dev/null | grep -q 'Dockerfile.prod'; then
  ok "El servicio frontend usa Dockerfile.prod (Caddy)"
else
  falla "El frontend NO usa Dockerfile.prod: se está usando la configuración de desarrollo (Vite en 5173)."
fi

titulo "4. Contenedores y puertos publicados"
docker compose ps --all --format 'table {{.Service}}\t{{.State}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || docker ps -a
ESTADO_FRONT=$(docker compose ps --all --format '{{.Service}} {{.State}}' 2>/dev/null | awk '$1=="frontend"{print $2}')
PUERTOS_FRONT=$(docker compose ps --format '{{.Service}} {{.Ports}}' 2>/dev/null | awk '$1=="frontend"')
if [ "$ESTADO_FRONT" != "running" ]; then
  falla "El contenedor frontend (Caddy) no está 'running' (estado: ${ESTADO_FRONT:-no existe}). Mira sus logs abajo."
elif echo "$PUERTOS_FRONT" | grep -q ':80->80' && echo "$PUERTOS_FRONT" | grep -q ':443->443'; then
  ok "frontend publica 80 y 443"
else
  falla "frontend está arriba pero NO publica 80/443: $PUERTOS_FRONT"
fi

titulo "5. Quién escucha en 80/443 en el host"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | awk 'NR==1 || $4 ~ /:(80|443)$/'
  if ss -ltnp 2>/dev/null | awk '$4 ~ /:(80|443)$/' | grep -qv docker-proxy && ss -ltnp 2>/dev/null | awk '$4 ~ /:(80|443)$/' | grep -q .; then
    aviso "Hay algo distinto de docker-proxy en 80/443 (revisa la columna de proceso)."
  fi
fi
for servicio in nginx apache2 httpd caddy; do
  if systemctl is-active --quiet "$servicio" 2>/dev/null; then
    falla "El servicio del host '$servicio' está activo y puede ocupar el puerto 80/443. Detenlo: sudo systemctl disable --now $servicio"
  fi
done

titulo "6. Firewall local (ufw)"
if command -v ufw >/dev/null 2>&1; then
  sudo -n ufw status 2>/dev/null || ufw status 2>/dev/null || aviso "No pude leer ufw (ejecuta con sudo)."
  aviso "Docker publica sus puertos por encima de ufw, así que ufw no suele ser la causa; el Cloud Firewall de DigitalOcean SÍ lo es (ver punto 8)."
fi

titulo "7. DNS del dominio frente a la IP del droplet"
es_ipv4() { printf '%s' "$1" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; }
# Metadatos de DigitalOcean primero; si no, un servicio externo. Se valida el
# formato porque un proxy o un error devuelven texto en lugar de una IP.
IP_PUBLICA=$(curl -sf --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null)
es_ipv4 "$IP_PUBLICA" || IP_PUBLICA=$(curl -sf --max-time 5 https://ifconfig.me 2>/dev/null)
es_ipv4 "$IP_PUBLICA" || IP_PUBLICA=""
echo "  IP pública del droplet: ${IP_PUBLICA:-desconocida}"
if [ -n "${DOMINIO:-}" ]; then
  for host in "$DOMINIO" "www.$DOMINIO"; do
    IPS=$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')
    if [ -z "$IPS" ]; then
      if [ "$host" = "www.$DOMINIO" ]; then
        aviso "$host no resuelve: crea su registro DNS o quita el bloque www del Caddyfile (Caddy reintentará su certificado)."
      else
        falla "$host no resuelve."
      fi
    elif [ -z "$IP_PUBLICA" ]; then
      aviso "$host → $IPS (no pude averiguar la IP del droplet para compararla)"
    elif echo "$IPS" | grep -qw "$IP_PUBLICA"; then
      ok "$host → $IPS"
    else
      falla "$host → $IPS, pero el droplet es $IP_PUBLICA"
    fi
  done
  if getent ahostsv6 "$DOMINIO" 2>/dev/null | grep -q ':'; then
    aviso "$DOMINIO tiene registro AAAA (IPv6). Si el droplet no tiene IPv6 activo, Let's Encrypt y algunos navegadores fallarán: bórralo o activa IPv6."
  fi
fi

titulo "8. Respuesta HTTP desde el propio droplet"
if [ -n "${DOMINIO:-}" ]; then
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: $DOMINIO" http://127.0.0.1/ 2>/dev/null)
  if [ "$CODIGO" = "308" ] || [ "$CODIGO" = "301" ] || [ "$CODIGO" = "200" ]; then
    ok "http://127.0.0.1 (Host: $DOMINIO) → $CODIGO: Caddy responde en el puerto 80"
  else
    falla "http://127.0.0.1 (Host: $DOMINIO) → ${CODIGO:-sin respuesta}: nada atiende el puerto 80 dentro del droplet"
  fi
  if [ -n "$IP_PUBLICA" ]; then
    CODIGO_PUB=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Host: $DOMINIO" "http://$IP_PUBLICA/" 2>/dev/null)
    echo "  http://$IP_PUBLICA (Host: $DOMINIO) → ${CODIGO_PUB:-sin respuesta}"
  fi
  CODIGO_TLS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/" 2>/dev/null)
  if [ "$CODIGO_TLS" = "200" ]; then
    ok "https://$DOMINIO (local) → 200 con certificado válido"
  else
    aviso "https://$DOMINIO (local) → ${CODIGO_TLS:-sin respuesta / certificado aún no emitido}. Revisa los logs de Caddy."
  fi
  echo
  echo "  Si todo lo anterior está bien pero desde tu PC no carga, el bloqueo está FUERA del droplet:"
  echo "  DigitalOcean → Networking → Firewalls: el firewall asignado al droplet debe permitir"
  echo "  entrada TCP 80, TCP 443 (y UDP 443 para HTTP/3)."
fi

titulo "9. Últimos logs de Caddy (frontend)"
docker compose logs --tail 25 frontend 2>/dev/null || true

echo
if [ "$PROBLEMAS" -eq 0 ]; then
  printf '\033[32mSin problemas detectados en el droplet.\033[0m Si desde fuera no carga, revisa el Cloud Firewall de DigitalOcean.\n'
else
  printf '\033[31m%d problema(s) detectado(s).\033[0m Corrige los marcados con ✘ y vuelve a ejecutar:\n' "$PROBLEMAS"
  echo "  docker compose up -d --build && bash scripts/diagnostico_despliegue.sh"
fi
