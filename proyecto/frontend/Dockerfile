FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# En docker-compose `node_modules` vive en un volumen anónimo que sobrevive a
# `--build`: si el package-lock cambia (p. ej. llega gsap), la dependencia no
# entraría al contenedor y Vite dejaría la app en blanco. Por eso, al arrancar,
# `npm ci` corre solo si el lockfile difiere del de la última instalación (y no
# reescribe el lockfile). Solo es la imagen de desarrollo: producción usa
# Dockerfile.prod (Caddy).
CMD ["sh", "-c", "cmp -s package-lock.json node_modules/.lock-instalado || (npm ci --no-audit --no-fund && cp package-lock.json node_modules/.lock-instalado); exec npm run dev -- --host 0.0.0.0"]
