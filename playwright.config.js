// Minimal Playwright harness scoped to Freedom Trader only. Does not start
// its own dev server (a server is usually already running for this repo);
// point FREEDOM_TRADER_E2E_BASE_URL at whichever instance to test against.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/freedom-trader",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/freedom-trader/global-setup.js",
  globalTeardown: "./e2e/freedom-trader/global-teardown.js",
  use: {
    baseURL: process.env.FREEDOM_TRADER_E2E_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
