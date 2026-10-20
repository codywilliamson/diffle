import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const numbered = (change: (n: number) => string): string =>
  Array.from({ length: 40 }, (_, i) => change(i + 1)).join("\n") + "\n";

const FILES = [{ path: "a.ts", base: numbered((n) => `line ${n}`), work: numbered((n) => (n === 5 ? "LINE 5" : `line ${n}`)) }];

const editor = (page: Page) => page.getByRole("textbox", { name: "Comment text" });
const serverDrafts = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(async () => ((await (await fetch("/api/drafts")).json()) as { drafts: Record<string, string> }).drafts);

async function openOnLine(page: Page, url: string): Promise<void> {
  await gotoApp(page, url);
  await expect(page.locator("tr.diff-row").first()).toBeVisible();
  await page.keyboard.press("j");
}

test("an unsent comment survives Escape and a reload, and is gone after Cancel", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    const appUrl = await url;
    await openOnLine(page, appUrl);
    await page.keyboard.press("c");
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type("not ready to send");

    // Escape closes the box but keeps the text, locally and on the server
    await page.keyboard.press("Escape");
    await expect(editor(page)).toHaveCount(0);
    await page.keyboard.press("c");
    await expect(editor(page)).toHaveValue("not ready to send");
    await page.keyboard.press("Escape");
    await expect.poll(async () => Object.values(await serverDrafts(page))).toEqual(["not ready to send"]);

    // a fresh page load (a new tab on a new port would do the same) gets it back
    await page.reload();
    await expect(page.locator("tr.diff-row").first()).toBeVisible();
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await expect(editor(page)).toHaveValue("not ready to send");

    // Cancel is the explicit discard
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect.poll(async () => Object.keys(await serverDrafts(page))).toEqual([]);
    await page.keyboard.press("c");
    await expect(editor(page)).toHaveValue("");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("sending a comment clears its draft, and editing another comment keeps the first one's text", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await openOnLine(page, await url);
    await page.keyboard.press("c");
    await page.keyboard.type("first note");
    await page.keyboard.press("Control+Enter");
    await expect(page.locator(".comment-card")).toHaveCount(1);
    await expect.poll(async () => Object.keys(await serverDrafts(page))).toEqual([]);

    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await page.keyboard.type("second note");
    await page.keyboard.press("Control+Enter");
    await expect(page.locator(".comment-card")).toHaveCount(2);

    // edit the first, type something, then start editing the second: the first keeps its text
    await page.locator(".comment-card").first().getByRole("button", { name: "Edit" }).click();
    await page.keyboard.type(" plus more");
    await page.locator(".comment-card").last().getByRole("button", { name: "Edit" }).click();
    await expect(editor(page)).toHaveValue("second note");
    await page.keyboard.press("Escape");
    await page.locator(".comment-card").first().getByRole("button", { name: "Edit" }).click();
    await expect(editor(page)).toHaveValue("first note plus more");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("text typed a moment before a reload still makes it to the server", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await openOnLine(page, await url);
    await page.keyboard.press("c");
    await page.keyboard.type("typed right before leaving");
    // reload inside the debounce window: only the unload flush can save it
    await page.reload();
    await expect(page.locator("tr.diff-row").first()).toBeVisible();
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await expect(editor(page)).toHaveValue("typed right before leaving");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
