import { test, expect } from "@playwright/test";
import { THEMES, expectSnapshot, withScene } from "./kit";
import { COMMENTS_ADDRESSED, COMMENTS_MIXED, COMMENTS_RANGE, STANDARD_FILES } from "./fixtures";

for (const theme of THEMES) {
  test.describe(theme, () => {
    test("open comment box", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme }, async (p) => {
        // unified rows repeat line numbers across old and new, so pick the added row by its text
        const addedRow = p.locator("tr").filter({ hasText: "${punctuation}" });
        await addedRow.getByRole("button", { name: /Comment on line 3/ }).click();
        await p.getByRole("textbox", { name: "Comment text" }).fill("Should this default to an exclamation mark?");
        await p.mouse.move(0, 0);
        await expectSnapshot(p, "comment-box", theme);
      });
    });

    test("range comment", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme, comments: COMMENTS_RANGE }, async (p) => {
        await expect(p.getByText(/read better as one template literal/)).toBeVisible();
        await expectSnapshot(p, "range-comment", theme);
      });
    });

    test("agent reply and addressed status", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme, comments: COMMENTS_ADDRESSED }, async (p) => {
        await expect(p.getByText(/signed off in the review thread/)).toBeVisible();
        await expectSnapshot(p, "agent-reply-addressed", theme);
      });
    });

    test("review panel", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme, comments: COMMENTS_MIXED }, async (p) => {
        await p.getByRole("button", { name: /Review menu/ }).click();
        await p.getByRole("textbox", { name: "Reviewer summary" }).fill("Mostly good, two small questions.");
        await expectSnapshot(p, "review-panel", theme);
      });
    });

    test("feedback preview", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme, comments: COMMENTS_MIXED }, async (p) => {
        await p.keyboard.press("P");
        await expect(p.getByRole("dialog", { name: "Feedback preview" })).toBeVisible();
        await expect(p.getByText("Compiling feedback")).toHaveCount(0);
        await expectSnapshot(p, "feedback-preview", theme);
      });
    });

    test("scorecard", async ({ page }) => {
      await withScene(page, { files: STANDARD_FILES, theme }, async (p) => {
        await p.getByRole("button", { name: /Review scorecard/ }).click();
        await p.mouse.move(0, 0);
        await expect(p.getByTestId("scorecard-totals")).toBeVisible();
        await expectSnapshot(p, "scorecard", theme);
      });
    });
  });
}
