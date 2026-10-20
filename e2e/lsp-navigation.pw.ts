// code navigation against a real typescript-language-server: Ctrl+click and gd into another
// file, the read-only viewer, hover, references and symbols, with Ctrl+o back. skipped when the
// server is not on PATH; CI's `lsp (ubuntu)` job installs it and sets REQUIRE_REAL_LSP so a missing
// install fails instead.

import { rmSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { ChildProcess } from "node:child_process";
import { cleanup, gotoApp, startPreview, stop } from "./harness";
import { findLanguageServer, makeLspFixture } from "./lspFixture";

const server = findLanguageServer();
const COLD_START_MS = 60_000;

test("the language server is installed where it is required", () => {
  if (process.env.REQUIRE_REAL_LSP) expect(server).toBeDefined();
});

test.describe("code navigation (real typescript-language-server)", () => {
  test.skip(!server, "typescript-language-server is not on PATH");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(COLD_START_MS);

  let fixture: string;
  let preview: ChildProcess;
  let url: string;

  test.beforeAll(async () => {
    fixture = makeLspFixture(server!);
    const started = startPreview(fixture, { seenWhatsNew: true });
    preview = started.server;
    url = await started.url;
  });

  test.afterAll(async () => {
    if (preview) await stop(preview);
    if (fixture) {
      cleanup(fixture);
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await gotoApp(page, url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();
  });

  // viewport center of a word in a rendered row, after scrolling its file into view
  async function wordPoint(page: Page, file: string, line: number, word: string): Promise<{ x: number; y: number }> {
    const row = page.locator(`[data-file-path="${file}"] .code-inner[data-lsp-side="new"][data-lsp-line="${line}"]`);
    await row.scrollIntoViewIfNeeded();
    return row.evaluate((root, needle) => {
      const text = root.textContent ?? "";
      const start = text.search(new RegExp("\\b" + needle + "\\b"));
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
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }, word);
  }

  async function cursorIs(page: Page, file: string, newLine: string): Promise<void> {
    const row = page.locator(`[data-file-path="${file}"] [data-cursor]`);
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("data-newline", newLine);
  }

  // main.ts: J lands on the file, j on its first row; returns that row's new line number
  async function startInMain(page: Page): Promise<string> {
    await page.keyboard.press("J");
    await page.keyboard.press("j");
    const row = page.locator(`[data-file-path="src/main.ts"] [data-cursor]`);
    await expect(row).toHaveCount(1);
    return (await row.getAttribute("data-newline")) ?? "";
  }

  async function moveCursorTo(page: Page, file: string, newLine: string): Promise<void> {
    for (let i = 0; i < 12; i++) {
      const row = page.locator(`[data-file-path="${file}"] [data-cursor]`);
      if ((await row.count()) === 1 && (await row.getAttribute("data-newline")) === newLine) return;
      await page.keyboard.press("j");
    }
    await cursorIs(page, file, newLine);
  }

  async function ctrlClick(page: Page, file: string, line: number, word: string): Promise<void> {
    const at = await wordPoint(page, file, line, word);
    await page.keyboard.down("Control");
    await page.mouse.click(at.x, at.y);
    await page.keyboard.up("Control");
  }

  test("Ctrl+click goes to a definition in another changed file, and Ctrl+o returns", async ({ page }) => {
    const start = await startInMain(page);
    await ctrlClick(page, "src/main.ts", 6, "greet");
    await cursorIs(page, "src/greeter.ts", "4");
    await page.keyboard.press("Control+o");
    await cursorIs(page, "src/main.ts", start);
  });

  test("Ctrl+click maps to the right word on a wrapped line", async ({ page }) => {
    await page.setViewportSize({ width: 520, height: 800 });
    await page.keyboard.press("w");
    await expect(page.locator(".diff-scroll.wrap").first()).toBeVisible();
    const start = await startInMain(page);
    // `label` sits on the second visual line of main.ts line 6
    const label = await wordPoint(page, "src/main.ts", 6, "label");
    const first = await wordPoint(page, "src/main.ts", 6, "console");
    expect(label.y).toBeGreaterThan(first.y + 4);
    await ctrlClick(page, "src/main.ts", 6, "label");
    await expect(page.locator("[data-lsp-viewer] [data-target-line]")).toContainText("export const label");
    await page.keyboard.press("Control+o");
    await cursorIs(page, "src/main.ts", start);
  });

  test("a definition in an unchanged repo file opens the read-only view with the line marked", async ({ page }) => {
    const start = await startInMain(page);
    await ctrlClick(page, "src/main.ts", 6, "label");
    const viewer = page.locator("[data-lsp-viewer]");
    await expect(viewer).toBeVisible();
    await expect(viewer.locator("[data-viewer-path]")).toHaveText("src/text.ts");
    await expect(viewer.locator("[data-target-line]")).toContainText("export const label");
    await expect(viewer.getByText("read-only")).toBeVisible();
    // Ctrl+o closes it and returns to the cursor
    await page.keyboard.press("Control+o");
    await expect(viewer).toHaveCount(0);
    await cursorIs(page, "src/main.ts", start);
  });

  test("in visual mode the first Esc closes the viewer, the next ends the range", async ({ page }) => {
    await startInMain(page);
    await page.keyboard.press("V");
    const selected = page.locator(".range-selected");
    await expect(selected.first()).toBeVisible();
    await ctrlClick(page, "src/main.ts", 6, "label");
    const viewer = page.locator("[data-lsp-viewer]");
    await expect(viewer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await expect(selected.first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(selected).toHaveCount(0);
  });

  test("a definition outside the repo opens read-only with its absolute path", async ({ page }) => {
    await startInMain(page);
    await ctrlClick(page, "src/main.ts", 6, "double");
    const viewer = page.locator("[data-lsp-viewer]");
    await expect(viewer.locator("[data-viewer-path]")).toContainText("tiny-dep");
    await expect(viewer.locator("[data-viewer-path]")).toContainText("index.d.ts");
    await expect(viewer.locator("[data-outside-repo]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
  });

  test("gd on the cursor line's first identifier, then Esc closes what opened", async ({ page }) => {
    await startInMain(page);
    // line 5 is `const greeter = new Greeter(...)`: the cursor word is `greeter`, a declaration,
    // so gd lists its references instead of going nowhere
    await moveCursorTo(page, "src/main.ts", "5");
    await page.keyboard.press("g");
    await page.keyboard.press("d");
    const panel = page.locator("[data-references-panel]");
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-references-summary]")).toContainText("references");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });

  test("hover shows docs after a dwell, follows the pointer to the next word, and Esc closes it", async ({ page }) => {
    const greet = await wordPoint(page, "src/main.ts", 6, "greet");
    await page.mouse.move(greet.x, greet.y);
    const card = page.locator("[data-hover-card]");
    await expect(card).toBeVisible();
    await expect(card).toContainText("greet(name: string): string");
    const label = await wordPoint(page, "src/main.ts", 6, "label");
    await page.mouse.move(label.x, label.y);
    await expect(card).toContainText("label");
    await expect(card).not.toContainText("greet(name: string)");
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
  });

  test("gA lists references, changed files first, and Enter jumps", async ({ page }) => {
    await startInMain(page);
    await moveCursorTo(page, "src/main.ts", "6");
    const greet = await wordPoint(page, "src/main.ts", 6, "greet");
    await page.mouse.move(greet.x, greet.y);
    await page.keyboard.press("g");
    await page.keyboard.press("A");
    const panel = page.locator("[data-references-panel]");
    await expect(panel.locator("[data-reference-group]")).toHaveCount(2);
    await expect(panel.locator("[data-reference-group]").first()).toContainText("src/greeter.ts");
    await expect(panel.locator("[data-changed-badge]")).toHaveCount(2);
    await expect(panel.locator("[data-reference-peek]")).toContainText("greet");
    await page.keyboard.press("Enter");
    await cursorIs(page, "src/greeter.ts", "4");
    await page.keyboard.press("Control+o");
    await cursorIs(page, "src/main.ts", "6");
  });

  test("gs filters the file's symbols by word start and jumps to one", async ({ page }) => {
    await page.keyboard.press("j");
    await expect(page.locator('[data-file-path="src/greeter.ts"] [data-cursor]')).toHaveCount(1);
    await page.keyboard.press("g");
    await page.keyboard.press("s");
    const rows = page.locator("[data-symbol-index]");
    await expect(rows.first()).toContainText("Greeter");
    await expect(rows.filter({ hasText: "greet" })).not.toHaveCount(0);
    await page.keyboard.type("sho");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("shout");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-symbol-list]")).toHaveCount(0);

    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await page.keyboard.type("greet");
    // the shorter name ranks first; the method overlaps the changed line, so it carries the mark
    await expect(rows.first()).toContainText("greet");
    await expect(rows.first()).toHaveAttribute("data-changed", "");
    await page.keyboard.press("Enter");
    await cursorIs(page, "src/greeter.ts", "4");
  });

  test("gS searches the repository's symbols", async ({ page }) => {
    await page.keyboard.press("g");
    await page.keyboard.press("S");
    await page.keyboard.type("Greeter");
    const classRow = page.locator("[data-symbol-index]").filter({ has: page.locator('[data-symbol-kind="class"]') });
    await expect(classRow).toHaveCount(1);
    await expect(classRow).toContainText("Greeter");
    await classRow.click();
    // greeter.ts line 1 is outside the diff's hunk, so the class opens in the read-only view
    await expect(page.locator("[data-lsp-viewer] [data-target-line]")).toContainText("export class Greeter");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-lsp-viewer]")).toHaveCount(0);
  });
});
