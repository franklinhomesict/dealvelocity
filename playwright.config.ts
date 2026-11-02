import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://acq:acq_dev@localhost:5432/acq_os_test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PW_CHROMIUM ?? undefined } } }],
  webServer: [
    { command: "node e2e/mock-dealmachine.mjs", port: 4010, reuseExistingServer: false },
    {
      command: `npx next start -p ${PORT}`,
      port: PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL, ALLOW_SAMPLE_DATA: "true", SESSION_SECRET: "test",
        DEALMACHINE_API_KEY: "dm_sk_live_test", DEALMACHINE_API_URL: "http://localhost:4010/v1", DEALMACHINE_WEBHOOK_SECRET: "whsec_test",
      },
    },
  ],
});
