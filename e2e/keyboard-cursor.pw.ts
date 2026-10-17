import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const numbered = (change: (n: number) => string): string =>
  Array.from({ length: 60 }, (_, i) => change(i + 1)).join("\n") + "\n";
const CHANGED = new Set([5, 40, 58]);

// a.ts has three separate hunks (lines 2-8, 37-43, 55-60); b.ts is one small hunk
const FILES = [
  { path: "a.ts", base: numbered((n) => `line ${n}`), work: numbered((n) => (CHANGED.has(n) ? `LINE ${n}` : `line ${n}`)) },
  { path: "b.ts", base: "x1\nx2\nx3\nx4\n", work: "x1\nx2\nX3\nx4\n" },
];

// where the cursor is: the file it sits in and the row's old/new line numbers.
async function cursorAt(page: Page): Promise<{ file: string | null; old: string | null; new: string | null }> {
  const row = page.locator("[data-cursor]");
  await expect(row).toHaveCount(1);
  return {
    file: await row.evaluate((el) => el.closest("[data-file-path]")?.getAttribute("data-file-path") ?? null),
    old: await row.getAttribute("data-oldline"),
    new: await row.getAttribute("data-newline"),
  };
}

async function open(page: Page, url: Promise<string>): Promise<void> {
  await gotoApp(page, await url);
  await expect(page.locator("tr.diff-row").first()).toBeVisible();
}

test("a line cursor moves with counts, hunk jumps, file jumps and the jump list", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await expect(page.locator("[data-cursor]")).toHaveCount(0);

    // the first hunk has eight rows (3 context, delete, add, 3 context), so 10j is the 2nd row of hunk 2
    await page.keyboard.type("10j");
    expect(await cursorAt(page)).toEqual({ file: "a.ts", old: "38", new: "38" });

    await page.keyboard.press("]");
    expect(await cursorAt(page)).toEqual({ file: "a.ts", old: "55", new: "55" });

    await page.keyboard.press("[");
    expect(await cursorAt(page)).toMatchObject({ file: "a.ts", new: "37" });

    await page.keyboard.press("J");
    expect(await cursorAt(page)).toEqual({ file: "b.ts", old: "1", new: "1" });

    await page.keyboard.press("G");
    expect(await cursorAt(page)).toEqual({ file: "b.ts", old: "4", new: "4" });

    await page.keyboard.press("g");
    await page.keyboard.press("g");
    expect(await cursorAt(page)).toEqual({ file: "b.ts", old: "1", new: "1" });

    await page.keyboard.press("Control+o");
    expect(await cursorAt(page)).toEqual({ file: "b.ts", old: "4", new: "4" });
    await page.keyboard.press("Control+i");
    expect(await cursorAt(page)).toEqual({ file: "b.ts", old: "1", new: "1" });

    await page.keyboard.press("K");
    expect(await cursorAt(page)).toMatchObject({ file: "a.ts", new: "2" });
    await page.keyboard.type("58G");
    expect(await cursorAt(page)).toMatchObject({ file: "a.ts", new: "58" });
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("the cursor scrolls into view only when it leaves the margin band", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    const pane = page.locator("[data-diff-pane]");
    await page.keyboard.type("3j");
    expect(await pane.evaluate((el) => el.scrollTop)).toBe(0);
    await page.keyboard.type("20j");
    await expect(page.locator("[data-cursor]")).toBeInViewport();
    expect(await pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press("G");
    await expect(page.locator("[data-cursor]")).toBeInViewport();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("h and l switch sides in split view", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("s");
    await expect(page.locator(".split-diff").first()).toBeVisible();
    await page.keyboard.type("4j"); // new side: 2, 3, 4, 5
    expect(await cursorAt(page)).toMatchObject({ file: "a.ts", new: "5" });
    await page.keyboard.press("h");
    expect(await cursorAt(page)).toMatchObject({ file: "a.ts", old: "5", new: "" });
    await expect(page.locator(".split-pane-old [data-cursor]")).toHaveCount(1);
    await page.keyboard.press("l");
    await expect(page.locator(".split-pane-new [data-cursor]")).toHaveCount(1);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("keys are ignored while typing in a field, and Esc clears a pending count", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.getByRole("button", { name: "Comment on a.ts" }).click();
    const box = page.getByRole("textbox", { name: "Comment text" });
    await box.focus();
    await page.keyboard.type("10jgg");
    await expect(box).toHaveValue("10jgg");
    await expect(page.locator("[data-cursor]")).toHaveCount(0);
    await box.blur();

    await page.keyboard.type("5");
    await page.keyboard.press("Escape");
    await page.keyboard.press("j");
    expect(await cursorAt(page)).toMatchObject({ file: "a.ts", new: "2" });
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("the moved keys open their overlays and help lists the table", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help).toBeVisible();
    await expect(help.getByRole("region", { name: "Move" })).toBeVisible();
    await expect(help.locator("kbd", { hasText: /^gc$/ })).toBeVisible();
    // Esc peels one layer: the pending count first, then the dialog
    await page.keyboard.press("5");
    await page.keyboard.press("Escape");
    await expect(help).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toHaveCount(0);

    await page.keyboard.press("P");
    await expect(page.getByRole("dialog", { name: "Feedback preview" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("g");
    await page.keyboard.press("w");
    await expect(page.getByRole("dialog", { name: /What's new/ })).toBeVisible();
    await page.keyboard.press("Escape");

    // c comments on the cursor line now; it no longer opens the preview
    await page.keyboard.press("c");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Comment text" })).toBeFocused();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
