#!/usr/bin/env bash
# Crea el .env de producción a partir de .env.production.example con todos los
# secretos ya generados (JWT, MySQL, Redis, Wompi events). Uso, en el servidor:
#
#   bash scripts/generar_env_produccion.sh zarpi.co
#
# Después solo queda editar a mano la API key de Resend (SMTP_API_KEY) y, si ya
# las tienes, las llaves reales de Wompi.
set -euo pipefail
cd "$(dirname "$0")/.."

DOMINIO="${1:-}"
if [ -z "$DOMINIO" ]; then
  echo "Uso: bash scripts/generar_env_produccion.sh tudominio.com" >&2
  exit 1
fi
if [ -e .env ]; then
  # Regenerar las contraseñas de MySQL sobre una base ya creada la dejaría
  # inaccesible: MySQL solo aplica MYSQL_PASSWORD la primera vez que arranca.
  echo "Ya existe .env; no se sobrescribe. Bórralo a mano si de verdad quieres regenerarlo." >&2
  exit 1
fi

secreto() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    python3 -c "import secrets; print(secrets.token_hex(32))"
  fi
}

sed \
  -e "s|^DOMINIO=.*|DOMINIO=${DOMINIO}|" \
  -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMINIO},https://www.${DOMINIO}|" \
  -e "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMINIO}|" \
  -e "s|^SECRET_KEY=.*|SECRET_KEY=$(secreto)|" \
  -e "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(secreto)|" \
  -e "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=$(secreto)|" \
  -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(secreto)|" \
  -e "s|^WOMPI_EVENTS_SECRET=.*|WOMPI_EVENTS_SECRET=$(secreto)|" \
  .env.production.example > .env
chmod 600 .env

echo ".env creado para ${DOMINIO} con secretos nuevos."
echo "Falta editar a mano:  SMTP_API_KEY (Resend)  y, si aplica, las llaves de Wompi."
echo "Luego:  docker compose up -d --build"
