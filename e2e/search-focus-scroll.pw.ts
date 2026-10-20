import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const NEEDLE = "FAR_NEEDLE";
const PADDING = "x".repeat(4000);
const LONG_BASE = `export const data = "${PADDING}";\nexport const tail = 1;\n`;
const LONG_WORK = `export const data = "${PADDING} ${NEEDLE}";\nexport const tail = 2;\n`;
const BASE = "const alpha = 1;\nconst beta = 2;\n";
const WORK = "const alpha = 1;\nconst beta = alpha;\nreturn alpha;\n";

const LONG = [{ path: "long-line.ts", base: LONG_BASE, work: LONG_WORK }];
const SHORT = [{ path: "short.ts", base: BASE, work: WORK }];
const counter = (page: Page) => page.locator("[data-search-count]");
const box = (page: Page) => page.getByLabel("Search this file");

async function open(page: Page, url: Promise<string>): Promise<void> {
  await gotoApp(page, await url);
  await expect(page.locator("tr.diff-row, .split-line").first()).toBeVisible();
}

for (const layout of ["unified", "split"] as const) {
  test(`a far-right match scrolls into view with wrap off (${layout})`, async ({ page }) => {
    const fixture = makeFixture(LONG);
    const { server, url } = startPreview(fixture, { seenWhatsNew: true });
    try {
      await open(page, url);
      if (layout === "split") {
        await page.keyboard.press("s");
        await expect(page.locator(".split-pane-old").first()).toBeVisible();
      }
      await page.keyboard.press("/");
      await expect(box(page)).toBeFocused();
      await page.keyboard.type(NEEDLE);
      await page.keyboard.press("Enter");
      await expect(counter(page)).toHaveText("1 / 1");
      await expect(page.locator("[data-file-path='long-line.ts'] mark.sm-active").first()).toBeInViewport();
    } finally {
      await stop(server);
      cleanup(fixture);
    }
  });
}

const scrollLefts = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-file-path='long-line.ts'] *")].map((el) => el.scrollLeft).filter((x) => x > 0));

test("plain cursor moves do not snap the pan back to an old match", async ({ page }) => {
  const fixture = makeFixture(LONG);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("/");
    await page.keyboard.type(NEEDLE);
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("1 / 1");
    await expect.poll(async () => (await scrollLefts(page)).length).toBeGreaterThan(0);
    await page.evaluate(() => document.querySelectorAll<HTMLElement>("[data-file-path='long-line.ts'] *").forEach((el) => (el.scrollLeft = 0)));
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.waitForTimeout(300);
    expect(await scrollLefts(page)).toEqual([]);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("split reveal keeps the match clear of the sticky gutter", async ({ page }) => {
  const fixture = makeFixture(LONG);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("s");
    await expect(page.locator(".split-pane-new").first()).toBeVisible();
    await page.keyboard.press("/");
    await page.keyboard.type(NEEDLE);
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("1 / 1");
    const mark = page.locator("[data-file-path='long-line.ts'] .split-pane-new mark.sm-active").first();
    await expect(mark).toBeInViewport();
    const gap = await mark.evaluate((el) => {
      const gutter = el.closest(".split-line")?.querySelector(".split-gutter")?.getBoundingClientRect();
      return el.getBoundingClientRect().left - (gutter?.right ?? 0);
    });
    expect(gap).toBeGreaterThanOrEqual(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("Enter hands focus to the diff so n steps with the query untouched, Esc clears", async ({ page }) => {
  const fixture = makeFixture(SHORT);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("/");
    await expect(box(page)).toBeFocused();
    await page.keyboard.type("alpha");
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("1 / 3");
    await expect(box(page)).not.toBeFocused();
    await page.keyboard.press("n");
    await expect(counter(page)).toHaveText("2 / 3");
    await expect(box(page)).toHaveValue("alpha");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-bar]")).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("Enter with no match keeps focus in the box", async ({ page }) => {
  const fixture = makeFixture(SHORT);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("/");
    await page.keyboard.type("nomatchhere");
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("No matches");
    await expect(box(page)).toBeFocused();
    await page.keyboard.type("n");
    await expect(box(page)).toHaveValue("nomatchheren");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
