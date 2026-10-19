import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const numbered = (change: (n: number) => string): string =>
  Array.from({ length: 20 }, (_, i) => change(i + 1)).join("\n") + "\n";

const FILES = [
  { path: "a.ts", base: numbered((n) => `line ${n}`), work: numbered((n) => (n === 5 ? "LINE 5" : `line ${n}`)) },
];

const SUGGESTED = "const five = 5;";
const BODY = `use a const\n\`\`\`suggestion\n${SUGGESTED}\n\`\`\``;
// optional: set NITTLE_SHOTS_DIR to write the review screenshots to a folder
const SHOTS_DIR = process.env.NITTLE_SHOTS_DIR;

async function shoot(page: Page, name: string, locator = page.locator("body")): Promise<void> {
  if (SHOTS_DIR) await locator.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
}

test("suggest change from the keyboard becomes a diff card and structured prompt data", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await page.setViewportSize({ width: 1100, height: 800 });
    await gotoApp(page, await url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();

    // cursor to line 5, extend over line 6, open the editor
    for (let i = 0; i < 5; i++) await page.keyboard.press("j"); // passes the deleted old line 5
    await expect(page.locator("[data-cursor]")).toHaveAttribute("data-newline", "5");
    await page.keyboard.press("V");
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    const editor = page.getByRole("textbox", { name: "Comment text" });
    await expect(editor).toBeFocused();

    await page.keyboard.press("Control+g");
    await expect(editor).toHaveValue("```suggestion\nLINE 5\nline 6\n```");
    await expect(editor).toHaveAccessibleDescription(/Ctrl\+G to suggest a change/);

    // the reviewer edits the fence down to one replacement line
    await editor.fill(BODY);
    await shoot(page, "editor-light", page.locator(".composer"));
    await page.keyboard.press("Control+Enter");
    await expect(editor).toHaveCount(0);

    const card = page.locator(".comment-card").first();
    await expect(card.locator(".suggestion .row-deletion")).toHaveText([/LINE 5/, /line 6/]);
    await expect(card.locator(".suggestion .row-addition")).toHaveText([new RegExp(SUGGESTED)]);
    await expect(card).not.toContainText("```");
    await shoot(page, "card-light", card);

    await page.keyboard.press("t");
    await shoot(page, "card-dark", card);
    await page.keyboard.press("j");
    await page.keyboard.press("c");
    await expect(editor).toBeFocused();
    await page.keyboard.press("Control+g");
    await shoot(page, "editor-dark", page.locator(".composer"));
    await page.keyboard.press("Escape");

    const prompt = await page.evaluate(async () => ((await (await fetch("/api/compile")).json()) as { prompt: string }).prompt);
    expect(prompt).toContain("ORIGINAL\n```\nLINE 5\nline 6\n```");
    expect(prompt).toContain(`SUGGESTED\n\`\`\`\n${SUGGESTED}\n\`\`\``);
    expect(prompt).toContain("lines 5–6");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("a file-level comment has no Suggest change and keeps its fence", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await gotoApp(page, await url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();
    await page.keyboard.press("C");
    const editor = page.getByRole("textbox", { name: "Comment text" });
    await expect(editor).toBeFocused();
    await expect(page.getByRole("button", { name: "Suggest change" })).toHaveCount(0);
    await editor.fill(BODY);
    await page.keyboard.press("Control+Enter");
    await expect(editor).toHaveCount(0);
    await expect(page.locator(".suggestion")).toHaveCount(0);
    const prompt = await page.evaluate(async () => ((await (await fetch("/api/compile")).json()) as { prompt: string }).prompt);
    expect(prompt).toContain("```suggestion");
    expect(prompt).not.toContain("ORIGINAL");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
