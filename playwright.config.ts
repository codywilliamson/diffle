import { defineConfig } from "@playwright/test";

// e2e specs use the `.pw.ts` suffix so neither `bun test` nor vitest ever picks them up.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.pw.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : "list",
  use: { headless: true, trace: "on-first-retry" },
});
