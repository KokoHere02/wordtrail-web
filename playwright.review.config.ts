import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'review.spec.ts',
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5175', channel: 'msedge', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node --experimental-strip-types node_modules/vite/bin/vite.js --configLoader native --mode mock --host 127.0.0.1 --port 5175 --strictPort',
    env: { VITE_UI_PREVIEW: 'false', VITE_ENABLE_MOCK: 'true' },
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  },
});
