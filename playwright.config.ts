import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node --experimental-strip-types node_modules/vite/bin/vite.js --configLoader native --port 5174",
    env: { VITE_UI_PREVIEW: "true", VITE_ENABLE_MOCK: "false" },
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
});
