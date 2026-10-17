import { defineConfig } from "@playwright/test";

const VISUAL_DIR = "**/visual/**";
const VIEWPORT = { width: 1280, height: 800 };

// e2e specs use the `.pw.ts` suffix so neither `bun test` nor vitest ever picks them up.
// two projects: `behavior` runs anywhere; `visual` holds pixel snapshots whose baselines are
// Linux-only, so it runs in the pinned playwright container (see scripts/e2e-docker.ts).
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : "list",
  // one platform-independent layout: e2e/__snapshots__/<spec file>/<name>.png
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFileName}/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" } },
  use: { headless: true, trace: "on-first-retry" },
  projects: [
    { name: "behavior", testMatch: "**/*.pw.ts", testIgnore: VISUAL_DIR },
    {
      name: "visual",
      testMatch: `${VISUAL_DIR}/*.pw.ts`,
      retries: 0,
      use: {
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        locale: "en-US",
        timezoneId: "UTC",
      },
    },
  ],
});
