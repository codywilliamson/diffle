import { defineConfig } from "@playwright/test";

// e2e specs use the `.pw.ts` suffix so neither `bun test` nor vitest ever picks them up.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.pw.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { headless: true },
});
