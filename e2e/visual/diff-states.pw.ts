import { test, expect } from "@playwright/test";
import { THEMES, expectSnapshot, withScene } from "./kit";
import { LARGE_FILES, MARKDOWN_FILES, STANDARD_FILES, WORD_DIFF_FILES } from "./fixtures";

const PHONE = { width: 390, height: 844 };

for (const theme of THEMES) {
  test.describe(theme, () => {
    test("unified diff", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme }, async (p) => {
        await expect(p.locator("td.code").first()).toBeVisible();
        await expectSnapshot(p, "unified", theme);
      });
    });

    test("split (side-by-side) diff", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme, split: true }, async (p) => {
        await expect(p.locator(".split-diff").first()).toBeVisible();
        await expectSnapshot(p, "split", theme);
      });
    });

    test("word diff marks", async ({ page }) => {
      await withScene(page, { files: WORD_DIFF_FILES, theme }, async (p) => {
        await expect(p.locator("td.code").first()).toBeVisible();
        await expectSnapshot(p, "word-diff", theme);
      });
    });

    test("markdown preview", async ({ page }) => {
      await withScene(page, { files: MARKDOWN_FILES, theme }, async (p) => {
        await p.getByRole("button", { name: "Toggle rendered preview" }).first().click();
        await expect(p.locator(".markdown-body h1").first()).toBeVisible();
        await expectSnapshot(p, "markdown-preview", theme);
      });
    });

    test("large file gate", async ({ page }) => {
      await withScene(page, { files: LARGE_FILES, theme }, async (p) => {
        await expect(p.getByText(/Large diff/)).toBeVisible();
        await expectSnapshot(p, "large-file-gate", theme);
      });
    });

    test("mobile file drawer", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme, viewport: PHONE }, async (p) => {
        await p.getByRole("button", { name: "Toggle file list" }).click();
        await expect(p.getByRole("navigation", { name: "Changed files" })).toBeVisible();
        await expectSnapshot(p, "mobile-drawer", theme);
      });
    });
  });
}
