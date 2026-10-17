import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const BASE = "const alpha = 1;\nconst beta = 2;\nconst gamma = alpha + beta;\nreturn gamma;\n";
const WORK = "const alpha = 1;\nconst Beta = 20;\nconst gamma = alpha + beta;\nreturn gamma + alpha;\n";

const numbered = (change: (n: number) => string): string =>
  Array.from({ length: 60 }, (_, i) => change(i + 1)).join("\n") + "\n";
const CHANGED = new Set([5, 40, 58]);
const FILES = [
  { path: "a.ts", base: BASE, work: WORK },
  { path: "long.ts", base: numbered((n) => `line ${n}`), work: numbered((n) => (CHANGED.has(n) ? `LINE ${n}` : `line ${n}`)) },
];

const counter = (page: Page) => page.locator("[data-search-count]");
const marks = (page: Page) => page.locator("[data-file-path='a.ts'] mark.sm");

async function open(page: Page, url: Promise<string>): Promise<void> {
  await gotoApp(page, await url);
  await expect(page.locator("tr.diff-row, .split-line").first()).toBeVisible();
}

async function search(page: Page, query: string): Promise<void> {
  await page.keyboard.press("/");
  await expect(page.getByLabel("Search this file")).toBeFocused();
  await page.keyboard.type(query);
}

test("search highlights matches, steps with n and N, wraps, and Esc clears", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await search(page, "alpha");
    await expect(marks(page)).toHaveCount(3);
    await expect(counter(page)).toHaveText("3 matches");

    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("1 / 3");
    await expect(page.locator("[data-file-path='a.ts'] [data-cursor]")).toHaveAttribute("data-newline", "1");
    await expect(page.locator("mark.sm-active")).toHaveCount(1);

    await page.keyboard.press("n");
    await expect(counter(page)).toHaveText("2 / 3");
    await expect(page.locator("[data-cursor]")).toHaveAttribute("data-newline", "3");
    await page.keyboard.press("n");
    await expect(counter(page)).toHaveText("3 / 3");
    await expect(page.locator("[data-cursor]")).toHaveAttribute("data-newline", "4");
    await page.keyboard.press("n");
    await expect(counter(page)).toHaveText("1 / 3");
    await page.keyboard.press("N");
    await expect(counter(page)).toHaveText("3 / 3");
    await page.keyboard.type("2N");
    await expect(counter(page)).toHaveText("1 / 3");

    // stepping is a jump
    await page.keyboard.press("Control+o");
    await expect(page.locator("[data-cursor]")).toHaveAttribute("data-newline", "4");

    // one Esc clears search and nothing else
    await page.keyboard.press("Escape");
    await expect(marks(page)).toHaveCount(0);
    await expect(page.locator("[data-search-bar]")).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("search is smartcase and Esc inside the box closes it", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await search(page, "beta");
    await expect(marks(page)).toHaveCount(3);
    await page.getByLabel("Search this file").fill("Beta");
    await expect(marks(page)).toHaveCount(1);
    await expect(counter(page)).toHaveText("1 match");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-bar]")).toHaveCount(0);
    await expect(marks(page)).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("matches show on both sides in split view and with wrapping on", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("s");
    await expect(page.locator(".split-pane-old").first()).toBeVisible();
    await page.keyboard.press("w");
    await search(page, "alpha");
    // two context lines show on both panes, the added line only on the new one
    await expect(page.locator("[data-file-path='a.ts'] .split-pane-old mark.sm")).toHaveCount(2);
    await expect(page.locator("[data-file-path='a.ts'] .split-pane-new mark.sm")).toHaveCount(3);
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("1 / 3");
    await page.keyboard.press("n");
    await page.keyboard.press("n");
    await expect(counter(page)).toHaveText("3 / 3");
    await expect(page.locator("[data-file-path='a.ts'] .split-pane-new [data-cursor]")).toHaveAttribute("data-newline", "4");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("stepping scrolls to a match in a later hunk and a selection prefills the box", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.locator("[data-file-path='a.ts'] .code-inner").first().dblclick();
    await page.keyboard.press("/");
    await expect(page.getByLabel("Search this file")).toHaveValue("const");
    await page.keyboard.press("Escape");

    await page.keyboard.press("J");
    await search(page, "LINE");
    await page.keyboard.press("Enter");
    await expect(counter(page)).toHaveText("1 / 3");
    await page.keyboard.type("2n");
    await expect(counter(page)).toHaveText("3 / 3");
    await expect(page.locator("[data-cursor]")).toBeInViewport();
    await expect(page.locator("[data-file-path='long.ts'] mark.sm-active")).toBeInViewport();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
