import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`
const isCi = process.env['CI'] !== undefined

/**
 * Os E2E rodam contra o build de produção (`vite preview`), não contra o servidor de desenvolvimento. A API é
 * simulada no navegador, com `page.route` (veja e2e/support/fakeApi.ts): o login real passa pelo Entra, que o CI
 * não alcança. Cada jornada roda em duas larguras, a do celular e a do desktop, porque o app tem dois layouts.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: isCi,
  // Sem retry: um teste instável tem de aparecer, não ficar escondido atrás de uma segunda tentativa.
  retries: 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'pt-BR',
    // O mesmo fuso do Vitest (vite.config.ts): o texto dos horários não depende da máquina.
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'celular-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 }, hasTouch: true } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
})
