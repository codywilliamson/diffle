// page helpers shared by the drivers and the stills: where a word sits in a rendered diff row,
// and where the keyboard line cursor is. same approach as e2e/lsp-navigation.pw.ts.
import type { Page } from "playwright";
import type { Rect } from "../meta";

const codeRow = (file: string, line: number, side: string): string =>
  `[data-file-path="${file}"] .code-inner[data-lsp-side="${side}"][data-lsp-line="${line}"]`;

// viewport box of the first whole-word `word` on a new-side (or old-side) row, scrolled into view.
export async function wordBox(page: Page, file: string, line: number, word: string, side = "new"): Promise<Rect> {
  const row = page.locator(codeRow(file, line, side)).first();
  await row.scrollIntoViewIfNeeded();
  return row.evaluate((root, needle) => {
    const text = root.textContent ?? "";
    const start = text.search(new RegExp(`\\b${needle}\\b`));
    if (start < 0) throw new Error(`${needle} not on row`);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let seen = 0;
    let began = false;
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!began && start < seen + node.data.length) {
        range.setStart(node, start - seen);
        began = true;
      }
      if (began && start + needle.length <= seen + node.data.length) {
        range.setEnd(node, start + needle.length - seen);
        break;
      }
      seen += node.data.length;
    }
    const box = range.getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height };
  }, word);
}

// the new-side line number the keyboard cursor is on in `file`, or null.
export async function cursorLine(page: Page, file: string): Promise<number | null> {
  const row = page.locator(`[data-file-path="${file}"] [data-cursor]`);
  if ((await row.count()) !== 1) return null;
  const value = await row.getAttribute("data-newline");
  return value ? Number(value) : null;
}

// press j (or k when past it) until the cursor sits on `line` of `file` (bounded, so a bad
// fixture fails loudly).
export async function cursorTo(page: Page, file: string, line: number, pace = 0): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const at = await cursorLine(page, file);
    if (at === line) return;
    await page.keyboard.press(at !== null && at > line ? "k" : "j");
    if (pace) await page.waitForTimeout(pace);
  }
  throw new Error(`cursor never reached ${file}:${line}`);
}

// open a changed file through the Ctrl+P fuzzy picker.
export async function pickFile(page: Page, query: string, pace = 0): Promise<void> {
  await page.keyboard.press("Control+p");
  await page.waitForTimeout(pace || 150);
  await page.keyboard.type(query, { delay: pace ? 70 : 0 });
  await page.waitForTimeout(pace || 150);
  await page.keyboard.press("Enter");
}
