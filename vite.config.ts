import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Proxy target: use VITE_API_BASE_URL from .env.local if set, otherwise MiniMax default
  const proxyTarget = env.VITE_API_BASE_URL || 'https://api.minimaxi.com/anthropic'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    worker: {
      format: 'es',
    },
    server: {
      proxy: {
        // /api/ai → proxies to the real API, bypassing CORS
        '/api/ai': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ai/, ''),
        },
      },
    },
  }
})
