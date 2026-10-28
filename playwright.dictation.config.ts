import { defineConfig } from '@playwright/test';
import reviewConfig from './playwright.review.config';
export default defineConfig({
  ...reviewConfig, testMatch: 'dictation.spec.ts',
  webServer: {
    ...reviewConfig.webServer as object,
    command: 'node --experimental-strip-types node_modules/vite/bin/vite.js --configLoader native --mode api --host 127.0.0.1 --port 5175 --strictPort',
    env: { VITE_UI_PREVIEW: 'false', VITE_ENABLE_MOCK: 'false' },
    url: 'http://127.0.0.1:5175', reuseExistingServer: false,
  },
});
