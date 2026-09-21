import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const MD = "# Title\n\nHello **world**\n\n<script>window.__pwned = 1</script>\n\n[ext](https://example.com)\n";

test("split view, wrap, and sanitized markdown preview", async ({ page }) => {
  const fixture = makeFixture([
    { path: "notes.md", base: "# Title\n\nHello\n", work: MD },
    { path: "code.ts", base: "const a = 1;\nconst b = 2;\n", work: "const a = 9;\nconst b = 2;\n" },
  ]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);

    // side-by-side toggle renders the split table
    await page.getByRole("button", { name: "Side-by-side view" }).click();
    await expect(page.locator("table.split-table").first()).toBeVisible();

    // wrap toggle applies the wrap class
    await page.getByRole("button", { name: "Wrap lines" }).click();
    await expect(page.locator(".wrap").first()).toBeVisible();

    // markdown preview renders sanitized html
    await page.getByRole("button", { name: "Toggle rendered preview" }).first().click();
    await expect(page.locator(".markdown-body h1").filter({ hasText: "Title" })).toBeVisible();
    // the embedded <script> was stripped and never executed
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    // external links open in a new tab
    await expect(page.locator('.markdown-body a[target="_blank"]')).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
