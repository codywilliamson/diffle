import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const numbered = (change: (n: number) => string): string =>
  Array.from({ length: 80 }, (_, i) => change(i + 1)).join("\n") + "\n";
const CHANGED = new Set([5, 70]);

const FILES = [
  { path: "a.ts", base: numbered((n) => `line ${n}`), work: numbered((n) => (CHANGED.has(n) ? `LINE ${n}` : `line ${n}`)) },
  { path: "b.ts", base: "x1\nx2\nx3\nx4\n", work: "x1\nx2\nX3\nx4\n" },
];

interface Saved {
  file: string;
  side?: string;
  line: number | null;
  endLine?: number;
  text: string;
}

const savedComments = (page: Page): Promise<Saved[]> =>
  page.evaluate(async () => ((await (await fetch("/api/comments")).json()) as { comments: Saved[] }).comments);

// counts any pointer or click event that reaches the page, so the test proves nothing used the mouse
async function watchMouse(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __mouse: string[] };
    w.__mouse = [];
    for (const type of ["mousedown", "mouseup", "click", "pointerdown", "pointerup"]) {
      window.addEventListener(type, (e) => w.__mouse.push(e.type), true);
    }
  });
}

const mouseEvents = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __mouse: string[] }).__mouse);

async function cursorNewLine(page: Page): Promise<string | null> {
  const row = page.locator("[data-cursor]");
  await expect(row).toHaveCount(1);
  return row.getAttribute("data-newline");
}

async function writeComment(page: Page, text: string): Promise<void> {
  const editor = page.getByRole("textbox", { name: "Comment text" });
  await expect(editor).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Control+Enter");
  await expect(editor).toHaveCount(0);
  await expect(page.locator("[data-diff-pane]")).toBeFocused();
}

test("line, range and file comments from the keyboard alone", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await watchMouse(page);
    await gotoApp(page, await url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();

    // c: the cursor line (first j lands on line 2)
    await page.keyboard.press("j");
    expect(await cursorNewLine(page)).toBe("2");
    await page.keyboard.press("c");
    await writeComment(page, "line note");
    expect(await cursorNewLine(page)).toBe("2");

    // V 2j c: a range down from the cursor, highlighted live with the drag highlight
    await page.keyboard.press("V");
    await page.keyboard.type("2j");
    await expect(page.locator("tr.range-selected")).toHaveCount(3);
    await page.keyboard.press("c");
    await expect(page.locator("tr.range-selected")).toHaveCount(3); // now the editor's pending range
    await writeComment(page, "range down");
    expect(await cursorNewLine(page)).toBe("4");

    // V 2k c: the same lines selected upward make the same anchor
    await page.keyboard.press("V");
    await page.keyboard.type("2k");
    await page.keyboard.press("c");
    await writeComment(page, "range up");

    // Esc leaves the visual mode in one press and opens nothing
    await page.keyboard.press("V");
    await page.keyboard.press("j");
    await expect(page.locator("tr.range-selected")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.locator("tr.range-selected")).toHaveCount(0);
    expect(await cursorNewLine(page)).toBe("3");
    await page.keyboard.press("j");
    expect(await cursorNewLine(page)).toBe("4"); // back in normal mode

    // C far from the header: the editor scrolls into view and takes focus
    await page.keyboard.press("G");
    await page.keyboard.press("C");
    const fileEditor = page.getByRole("textbox", { name: "Comment text" });
    await expect(fileEditor).toBeFocused();
    await expect(fileEditor).toBeInViewport();
    const at = await cursorNewLine(page);
    await page.keyboard.type("file note");
    await page.keyboard.press("Control+Enter");
    await expect(fileEditor).toHaveCount(0);
    await expect(page.locator("[data-diff-pane]")).toBeFocused();
    expect(await cursorNewLine(page)).toBe(at);

    const saved = await savedComments(page);
    const byText = (text: string): Saved => saved.find((c) => c.text === text)!;
    expect(byText("line note")).toMatchObject({ file: "a.ts", side: "new", line: 2, endLine: 2 });
    expect(byText("range down")).toMatchObject({ file: "a.ts", side: "new", line: 2, endLine: 4 });
    expect(byText("range up")).toMatchObject({ file: "a.ts", side: "new", line: 2, endLine: 4 });
    expect(byText("file note")).toMatchObject({ file: "a.ts", line: null });

    expect(await mouseEvents(page)).toEqual([]);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
