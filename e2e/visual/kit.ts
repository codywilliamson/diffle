import { expect, type Page } from "@playwright/test";
import { PRODUCT } from "../../src/core/product";
import { cleanup, makeFixture, startPreview, stop, type FixtureFile } from "../harness";
import type { Comment } from "../../src/types";
import { FIXED_NOW } from "./fixtures";
import { routeFonts } from "./fonts";
import { seedReviewRecord } from "./seedRecord";

export type Theme = "light" | "dark";
export const THEMES: Theme[] = ["light", "dark"];

const FIXTURE_REPO_NAME = "demo-repo";
const SPLIT_RATIO = "50";

// kills every transition, animation, caret blink and smooth scroll the page might still run.
const FREEZE_CSS = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}`;

export interface SceneOptions {
  files: FixtureFile[];
  theme: Theme;
  comments?: Comment[];
  split?: boolean;
  viewport?: { width: number; height: number };
}

// everything volatile is pinned before the app loads: fonts come from e2e/visual/fonts, the clock
// is fixed, prefs are seeded, the home dir is a throwaway, and the what's-new modal is pre-seen.
async function pinPage(page: Page, options: SceneOptions): Promise<void> {
  await routeFonts(page);
  await page.clock.setFixedTime(FIXED_NOW);
  if (options.viewport) await page.setViewportSize(options.viewport);
  await page.addInitScript(
    ({ prefix, theme, split, ratio }) => {
      localStorage.setItem(`${prefix}-theme`, theme);
      localStorage.setItem(`${prefix}-split`, String(split));
      localStorage.setItem(`${prefix}-split-ratio`, ratio);
    },
    { prefix: PRODUCT.name, theme: options.theme, split: Boolean(options.split), ratio: SPLIT_RATIO },
  );
}

async function waitUntilSettled(page: Page): Promise<void> {
  await expect(page.getByRole("navigation", { name: "Changed files" }).or(page.getByRole("button", { name: "Toggle file list" }))).toBeVisible();
  // the scorecard chip lands when the analysis fetch finishes and shifts the top bar; wait for it
  await expect(page.locator('[aria-label^="Review scorecard"]')).toBeAttached();
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
}

// boots a fixture repo + real backend, hands the settled page to `run`, then tears everything down.
export async function withScene(page: Page, options: SceneOptions, run: (page: Page) => Promise<void>): Promise<void> {
  const fixture = makeFixture(options.files, { leaf: FIXTURE_REPO_NAME });
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    const address = await url;
    if (options.comments) seedReviewRecord(fixture, options.comments);
    await pinPage(page, options);
    await page.goto(address);
    await waitUntilSettled(page);
    await run(page);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
}

// the one assertion every state ends with: viewport pixels against the committed baseline.
export async function expectSnapshot(page: Page, name: string, theme: Theme): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}-${theme}.png`);
}
