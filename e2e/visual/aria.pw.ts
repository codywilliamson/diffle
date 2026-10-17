import { test, expect } from "@playwright/test";
import { withScene } from "./kit";
import { COMMENTS_MIXED, STANDARD_FILES } from "./fixtures";

// structure-only checks: cheaper than pixels and theme-independent, so one pass in light.
test("aria: file index and review trigger", async ({ page }) => {
  await withScene(page, { files: STANDARD_FILES, theme: "light", comments: COMMENTS_MIXED }, async (p) => {
    await expect(p.getByRole("navigation", { name: "Changed files" })).toMatchAriaSnapshot({ name: "file-index.aria.yml" });
    await expect(p.getByRole("button", { name: /Review menu/ })).toMatchAriaSnapshot({ name: "review-trigger.aria.yml" });
  });
});

test("aria: scorecard dialog", async ({ page }) => {
  await withScene(page, { files: STANDARD_FILES, theme: "light" }, async (p) => {
    await p.getByRole("button", { name: /Review scorecard/ }).click();
    await expect(p.getByRole("dialog", { name: "Review scorecard" })).toMatchAriaSnapshot({ name: "scorecard.aria.yml" });
  });
});
