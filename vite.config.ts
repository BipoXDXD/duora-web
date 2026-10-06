import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const API_ORIGIN = 'http://localhost:8080'

// Sem changeOrigin: o Host continua localhost:5173, então o Spring monta o redirect_uri do Entra
// para o próprio Vite, e o cookie de sessão nasce nesta origem (docs/adr/0002 da duora-api).
const apiProxy = { target: API_ORIGIN, changeOrigin: false }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': apiProxy,
      '/oauth2': apiProxy,
      '/login/oauth2': apiProxy,
      '/logout': apiProxy,
      '/actuator': apiProxy,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      reporter: ['text', 'html'],
    },
  },
})
