import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
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
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Configuración del Servidor de Desarrollo y Proxy para Docker
  server: {
    // Escucha en todas las interfaces para que el Dev Tunnel pueda exponerlo.
    host: true,
    // El browser remoto no alcanza localhost:8000: todo el tráfico de API y de
    // archivos viaja por este mismo origen y el proxy lo reenvía al backend.
    allowedHosts: ['.devtunnels.ms', '.ngrok-free.app', '.ngrok.io', '.trycloudflare.com'],
    proxy: {
      '/api': {
        // Apunta al contenedor de Docker en tu máquina local
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // Elimina el prefijo /api antes de enviar la petición a FastAPI
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})