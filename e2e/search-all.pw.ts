import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const filler = (tag: string): string => Array.from({ length: 12 }, (_, i) => `// ${tag} filler ${i}`).join("\n");

// a.ts: a plain modified file; gone.ts: deleted (starts collapsed); legacy.ts -> modern.ts: renamed
// with a marker that only exists on the old side.
const FILES = [
  { path: "a.ts", base: "const needle = 1;\nconst other = 2;\n", work: "const needle = 10;\nconst other = 2;\nconst needleTwo = 3;\n" },
  { path: "gone.ts", base: "export const needleGone = true;\nexport const keep = 1;\n", work: "export const keep = 1;\n" },
  { path: "legacy.ts", base: `${filler("rename")}\nconst legacyMarker = 1;\nexport const stays = 2;\n`, work: `${filler("rename")}\nconst fresh = 1;\nexport const stays = 2;\n` },
];

function setup() {
  const fixture = makeFixture(FILES);
  execFileSync("git", ["mv", "legacy.ts", "modern.ts"], { cwd: fixture });
  rmSync(join(fixture, "gone.ts"));
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  return { fixture, server, url };
}

async function openSearch(page: Page, url: Promise<string>, query: string): Promise<void> {
  await gotoApp(page, await url);
  await expect(page.locator("tr.diff-row, .split-line").first()).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("/");
  await expect(page.getByRole("textbox", { name: "Search all changed files" })).toBeFocused();
  await page.keyboard.type(query);
}

const options = (page: Page) => page.locator("[data-search-results] [role=option]");

test("g/ lists hits grouped by file and Enter jumps into a collapsed file", async ({ page }) => {
  const { fixture, server, url } = setup();
  try {
    await openSearch(page, url, "needle");
    await expect(page.locator("[data-search-group]")).toHaveText(["a.ts", "gone.ts"]);
    await expect(options(page)).toHaveCount(4);
    await expect(page.locator("[data-file-path='gone.ts'] [data-cursor]")).toHaveCount(0);

    // arrows move; Enter on the gone.ts hit expands the collapsed file and lands on its old line
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-file-path='gone.ts'] [data-cursor]")).toHaveAttribute("data-oldline", "1");

    // j and k move in the list now that it has focus; Enter jumps again
    await page.keyboard.press("k");
    await page.keyboard.press("k");
    await page.keyboard.press("k");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-file-path='a.ts'] [data-cursor]")).toHaveAttribute("data-oldline", "1");

    // the jump is recorded: Ctrl+o returns to the previous spot
    await page.keyboard.press("Control+o");
    await expect(page.locator("[data-file-path='gone.ts'] [data-cursor]")).toHaveAttribute("data-oldline", "1");

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-all]")).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("an old-side hit in a renamed file lands on the old line", async ({ page }) => {
  const { fixture, server, url } = setup();
  try {
    await openSearch(page, url, "legacyMarker");
    await expect(page.locator("[data-search-group]")).toHaveText(["legacy.ts"]);
    await expect(options(page)).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-file-path='modern.ts'] [data-cursor]")).toHaveAttribute("data-oldline", "13");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("a bad regex shows the server's message and Esc closes the panel", async ({ page }) => {
  const { fixture, server, url } = setup();
  try {
    await openSearch(page, url, "(");
    await page.getByRole("button", { name: "Regular expression" }).click();
    await expect(page.locator("[data-search-all-error]")).toBeVisible();
    await expect(page.locator("[data-search-all-error]")).not.toHaveText("");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-all]")).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
