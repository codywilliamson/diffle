// one stills session: a fresh fixture + backend + browser context at the docs resolution. shared
// by screenshots.ts (the original gallery) and featureShots.ts (the launch feature stills).
import type { Browser, Page } from "playwright";
import { join } from "node:path";
import { makeFixture, startBackend, stop, cleanup, type FixtureFile, type FixtureOptions } from "./backend";

export const SHOT_WIDTH = 1440;
export const SHOT_HEIGHT = 900;

export interface Session {
  page: Page;
  fixture: string;
  teardown: () => Promise<void>;
}

export interface SessionOptions extends FixtureOptions {
  theme?: "light" | "dark";
  args?: string[]; // backend cli args, e.g. ["show", "HEAD"]
}

export async function openSession(browser: Browser, files: FixtureFile[], options: SessionOptions = {}): Promise<Session> {
  const fixture = makeFixture(files, options);
  const { server, url } = startBackend(fixture, options.args);
  const reviewUrl = await url;
  const context = await browser.newContext({
    viewport: { width: SHOT_WIDTH, height: SHOT_HEIGHT },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: options.theme ?? "dark",
  });
  const page = await context.newPage();
  await page.goto(reviewUrl);
  // the backend seeds the seen version, so this only fires if that seeding ever breaks
  await page
    .getByRole("dialog", { name: /What's new/ })
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => page.keyboard.press("Escape"))
    .catch(() => {});
  return {
    page,
    fixture,
    teardown: async () => {
      await context.close();
      await stop(server);
      cleanup(fixture);
    },
  };
}

export async function shoot(page: Page, dir: string, id: string): Promise<void> {
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(dir, `${id}.png`) });
  console.log(`shot ${id}`);
}
