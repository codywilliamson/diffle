import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const numbered = (change: (n: number) => string): string =>
  Array.from({ length: 40 }, (_, i) => change(i + 1)).join("\n") + "\n";

const FILES = [{ path: "a.ts", base: numbered((n) => `line ${n}`), work: numbered((n) => (n === 5 ? "LINE 5" : `line ${n}`)) }];

const savedTexts = (page: Page): Promise<string[]> =>
  page.evaluate(async () => ((await (await fetch("/api/comments")).json()) as { comments: Array<{ text: string }> }).comments.map((c) => c.text));

async function writeComment(page: Page, text: string): Promise<void> {
  const editor = page.getByRole("textbox", { name: "Comment text" });
  await expect(editor).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Control+Enter");
  await expect(editor).toHaveCount(0);
  await expect(page.locator("[data-diff-pane]")).toBeFocused();
}

test("the Delete button offers the same undo as dd, and two quick deletes both stick", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await gotoApp(page, await url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await writeComment(page, "first note");
    await page.keyboard.press("c");
    await writeComment(page, "second note");
    await expect(page.locator(".comment-card")).toHaveCount(2);

    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.locator(".comment-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".comment-card")).toHaveCount(2);
    await expect.poll(() => savedTexts(page)).toHaveLength(2);

    // back to back, without waiting for the first save to land
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.locator(".comment-card")).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await savedTexts(page)).toEqual([]);
    await page.reload();
    await expect(page.locator("tr.diff-row").first()).toBeVisible();
    await expect(page.locator(".comment-card")).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("e on an inline comment in a collapsed file expands it and opens the editor", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await gotoApp(page, await url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await writeComment(page, "tweak me");

    await page.getByRole("button", { name: "Collapse a.ts" }).click();
    await expect(page.locator(".comment-card")).toHaveCount(0);
    await page.keyboard.press("e");
    await expect(page.getByRole("button", { name: "Collapse a.ts" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Comment text" })).toHaveValue("tweak me");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
