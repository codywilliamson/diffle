import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

test("unified diff renders highlighted code and collapses", async ({ page }) => {
  const fixture = makeFixture([
    { path: "sum.ts", base: "export const sum = (a, b) => a + b;\n", work: "export const sum = (a, b) => a - b;\n" },
  ]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);

    // a hunk header pill and the added/removed content render in the code column
    await expect(page.getByText(/@@ .* @@/)).toBeVisible();
    await expect(page.locator("td.code").filter({ hasText: "a - b" })).toBeVisible();
    await expect(page.locator("td.code").filter({ hasText: "a + b" })).toBeVisible();
    // syntax highlighting is applied (tokens are colored with the D5 syntax vars)
    await expect(page.locator('td.code span[style*="--syn-keyword"]').first()).toBeVisible();

    // collapsing the file hides its rows
    await page.getByRole("button", { name: /^Collapse / }).first().click();
    await expect(page.locator("td.code").filter({ hasText: "a - b" })).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
