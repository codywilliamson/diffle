import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const A_BASE = ["// entry", 'import { b } from "./b";', "const a = 1;", "const x = 1;", "const y = 2;", "const z = 3;"].join("\n") + "\n";
const A_WORK = A_BASE.replace("const x = 1;", "const x = 10;");
const FILES = [
  { path: "src/a.ts", base: A_BASE, work: A_WORK },
  { path: "src/b.ts", base: "export const b = 1;\n", work: "export const b = 2;\n" },
  { path: "src/keymap.ts", base: "export const k = 1;\n", work: "export const k = 2;\n" },
];

const toggle = (page: Page, path: string, expanded: boolean) =>
  page.getByRole("button", { name: `${expanded ? "Collapse" : "Expand"} ${path}` });

test("gf, Ctrl+p, folds and gv from the keyboard", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await gotoApp(page, await url);
    await expect(page.locator("tr.diff-row").first()).toBeVisible();

    // gf: the import line names ./b, which is src/b.ts
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await expect(page.locator("[data-cursor]")).toContainText("./b");
    await page.keyboard.type("gf");
    await expect(page.locator("[data-cursor-file]")).toHaveCount(1);
    await expect(page.locator("[data-cursor-file]")).toContainText("src/b.ts");
    await page.keyboard.press("Control+o"); // back where gf left from
    await expect(page.locator("[data-cursor]")).toContainText("./b");

    // gf on a line that names nothing changes nothing
    await page.keyboard.press("j");
    await page.keyboard.type("gf");
    await expect(page.locator("[data-cursor]")).toContainText("const a = 1;");

    // Ctrl+p: fuzzy picker, typing filters, Enter jumps, Esc closes
    await page.keyboard.press("Control+p");
    const input = page.getByRole("textbox", { name: "Go to file" });
    await expect(input).toBeFocused();
    await expect(page.getByRole("option")).toHaveCount(3);
    await page.keyboard.type("sk");
    await expect(page.getByRole("option")).toHaveCount(1);
    await expect(page.getByRole("option")).toContainText("src/keymap.ts");
    await page.keyboard.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(page.locator("[data-cursor-file]")).toContainText("src/keymap.ts");
    await page.evaluate(() => {
      const w = window as unknown as { __ctrlP: boolean[] };
      w.__ctrlP = [];
      window.addEventListener("keydown", (e) => e.ctrlKey && e.key === "p" && w.__ctrlP.push(e.defaultPrevented));
    });
    await page.keyboard.press("Control+p");
    await expect(input).toBeFocused();
    // Ctrl+p inside the open picker is not the browser's print: the page takes it and closes the picker
    await page.keyboard.press("Control+p");
    await expect(input).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __ctrlP: boolean[] }).__ctrlP)).toEqual([true, true]);
    await page.keyboard.press("Control+p");
    await page.keyboard.press("Escape");
    await expect(input).toHaveCount(0);

    // zc / zo fold the current file; zC / zO fold all
    await page.keyboard.type("zc");
    await expect(toggle(page, "src/keymap.ts", false)).toBeVisible();
    await page.keyboard.type("zo");
    await expect(toggle(page, "src/keymap.ts", true)).toBeVisible();
    await page.keyboard.type("zC");
    for (const path of ["src/a.ts", "src/b.ts", "src/keymap.ts"]) await expect(toggle(page, path, false)).toBeVisible();
    await page.keyboard.type("zO");
    for (const path of ["src/a.ts", "src/b.ts", "src/keymap.ts"]) await expect(toggle(page, path, true)).toBeVisible();

    // a zC outlives the files on screen: switching to single-file view shows the next file collapsed
    await page.keyboard.type("zC");
    await page.keyboard.press("o");
    await page.keyboard.press("J");
    await expect(page.getByRole("button", { name: /^Expand / })).toBeVisible();
    await page.keyboard.press("o");
    await page.keyboard.type("zO");
    for (const path of ["src/a.ts", "src/b.ts", "src/keymap.ts"]) await expect(toggle(page, path, true)).toBeVisible();

    // gv: reselect the last visual range
    await page.keyboard.press("Control+p");
    await page.keyboard.type("a");
    await page.keyboard.press("Enter");
    await page.keyboard.press("j");
    await page.keyboard.press("V");
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await expect(page.locator("tr.range-selected")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(page.locator("tr.range-selected")).toHaveCount(0);
    await page.keyboard.type("gv");
    await expect(page.locator("tr.range-selected")).toHaveCount(3);
    await page.keyboard.press("c");
    await expect(page.getByRole("textbox", { name: "Comment text" })).toBeFocused();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
