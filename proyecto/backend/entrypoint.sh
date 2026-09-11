#!/bin/sh
# Punto de entrada del contenedor backend.
#
# Antes las migraciones de Alembic dependían de que `init_db()` (dentro del
# lifespan de FastAPI) las corriera en el primer worker que ganara el lock de
# Redis: si Redis no estaba listo o el lock se perdía, el arranque seguía
# adelante con el esquema desactualizado sin que nadie lo notara hasta el
# primer 500. Aquí las migraciones corren una sola vez, antes de levantar
# Uvicorn, y si fallan el contenedor no arranca.
set -e

if [ -n "$DATABASE_URL" ] && [ "${DATABASE_URL#sqlite}" = "$DATABASE_URL" ]; then
  echo "Aplicando migraciones de Alembic (upgrade head)..."
  alembic upgrade head
else
  echo "DATABASE_URL es SQLite o no está definida; se omite Alembic (create_all lo resuelve al iniciar)."
fi

echo "Iniciando Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-2}"
