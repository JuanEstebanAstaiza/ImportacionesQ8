import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// El config lo ejecuta Node, pero el proyecto no trae @types/node: se accede a
// las variables de entorno por globalThis con un tipo local en vez de añadir
// una dependencia solo para esto.
const envNode = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

const srcAssetsBase = new URL('./src/assets/', import.meta.url)
const srcBase = new URL('./src/', import.meta.url)

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return new URL(filename, srcAssetsBase).pathname
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': srcBase.pathname,
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv', '**/*.png', '**/*.PNG'],

  // Configuración del Servidor de Desarrollo y Proxy para Docker
  server: {
    // Escucha en todas las interfaces para que el Dev Tunnel pueda exponerlo.
    host: true,
    port: 5173,
    // El browser remoto no alcanza localhost:8000: todo el tráfico de API y de
    // archivos viaja por este mismo origen y el proxy lo reenvía al backend.
    allowedHosts: true,
    // Los eventos de archivo del host no cruzan el bind mount de Docker en
    // Windows/macOS, así que dentro del contenedor la recarga en caliente no se
    // enteraba de ningún cambio. El sondeo cuesta CPU, de modo que se activa
    // solo ahí (VITE_USE_POLLING en docker-compose.yml).
    watch: envNode.VITE_USE_POLLING === 'true'
      ? { usePolling: true, interval: 300 }
      : undefined,
    proxy: {
      '/api': {
        // Dónde vive FastAPI visto DESDE el proceso de Vite (no desde el browser):
        // en el host es `localhost:8000`, pero si Vite corre en un contenedor ahí
        // `localhost` es el propio contenedor y hay que apuntar al servicio
        // (`http://backend:8000`, ver VITE_PROXY_TARGET en docker-compose.yml).
        target: envNode.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // Elimina el prefijo /api antes de enviar la petición a FastAPI
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
    fs: {
      strict: false, // Permite servir archivos fuera del estricto scope si hay symlinks
    },
  },
})