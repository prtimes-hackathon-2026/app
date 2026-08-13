import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT ?? 5173),
      // dev 中は /api を Hono に転送する。同一オリジンになるので CORS も cookie も素直に動く。
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET ?? 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  }
})
