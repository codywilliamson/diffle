import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const numbered = (change: (n: number) => string): string =>
  Array.from({ length: 40 }, (_, i) => change(i + 1)).join("\n") + "\n";

const FILES = [{ path: "a.ts", base: numbered((n) => `line ${n}`), work: numbered((n) => (n === 5 ? "LINE 5" : `line ${n}`)) }];

interface Saved {
  id: string;
  line: number | null;
  text: string;
  resolved?: boolean;
  status?: string;
}

const saved = (page: Page): Promise<Saved[]> =>
  page.evaluate(async () => ((await (await fetch("/api/comments")).json()) as { comments: Saved[] }).comments);

async function writeComment(page: Page, text: string): Promise<void> {
  const editor = page.getByRole("textbox", { name: "Comment text" });
  await expect(editor).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Control+Enter");
  await expect(editor).toHaveCount(0);
  await expect(page.locator("[data-diff-pane]")).toBeFocused();
}

test("e, R, yy, dd and { } act on the comment under the cursor", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await gotoApp(page, await url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();

    // two comments on line 2
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await writeComment(page, "first note");
    await page.keyboard.press("c");
    await writeComment(page, "second note");
    const cards = page.locator(".comment-card");
    await expect(cards).toHaveCount(2);
    await expect(page.locator("[data-key-focus]")).toContainText("first note");

    // } steps to the next comment on the line, { back
    await page.keyboard.press("}");
    await expect(page.locator("[data-key-focus]")).toContainText("second note");
    await page.keyboard.press("{");
    await expect(page.locator("[data-key-focus]")).toContainText("first note");

    // yy copies the focused comment
    await page.keyboard.type("yy");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("first note");

    // e opens the editor with the text; typing e inside it does not re-trigger the key
    await page.keyboard.press("e");
    const editor = page.getByRole("textbox", { name: "Comment text" });
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue("first note");
    await page.keyboard.type(" edited, dd R e");
    await expect(editor).toHaveValue("first note edited, dd R e");
    await page.keyboard.press("Control+Enter");
    await expect(editor).toHaveCount(0);
    await expect.poll(async () => (await saved(page)).map((c) => c.text)).toEqual(["first note edited, dd R e", "second note"]);

    // R resolves, R again reopens
    await page.keyboard.press("R");
    await expect.poll(async () => (await saved(page))[0]!.status === "resolved" || (await saved(page))[0]!.resolved === true).toBe(true);
    await page.keyboard.press("e"); // a resolved comment cannot be edited
    await expect(page.getByRole("textbox", { name: "Comment text" })).toHaveCount(0);
    await page.keyboard.press("R");
    await expect.poll(async () => (await saved(page))[0]!.status !== "resolved" && !(await saved(page))[0]!.resolved).toBe(true);

    // dd deletes the focused comment; one d alone does nothing, and d then another key is dropped
    await page.keyboard.press("d");
    await page.keyboard.press("j");
    expect((await saved(page)).length).toBe(2);
    await page.keyboard.press("k");
    await page.keyboard.type("dd");
    await expect.poll(async () => (await saved(page)).map((c) => c.text)).toEqual(["second note"]);

    // yy with no comment under the cursor copies the line; dd there deletes nothing
    await page.keyboard.press("j");
    await page.keyboard.type("yy");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("line 3");
    await page.keyboard.type("dd");
    await page.waitForTimeout(200);
    expect((await saved(page)).length).toBe(1);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
