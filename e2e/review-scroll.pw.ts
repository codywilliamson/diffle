import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

test("a long file index cannot extend the document below the review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = makeFixture(Array.from({ length: 60 }, (_, i) => ({
    path: `src/file-${String(i).padStart(2, "0")}.ts`,
    base: "const value = 1;\n",
    work: "const value = 2;\n",
  })));
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    const tree = page.getByRole("navigation", { name: "Changed files" });
    await expect(tree.getByRole("checkbox")).toHaveCount(60);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);

    // hidden but focusable controls belong to the sidebar scroller, so keyboard navigation
    // to its last entry scrolls the tree while the app shell and toolbar remain stationary.
    const last = tree.getByRole("checkbox", { name: "Mark src/file-59.ts viewed", exact: true });
    await last.focus();
    await last.press("Space");
    await expect(last).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
    await expect(page.getByRole("button", { name: /Review menu/ })).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);

    // wheel scrolling past the end of the actual diff cannot reveal another page of emptiness.
    await page.locator("main > div > section").evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await page.locator("main > div > section").hover();
    await page.mouse.wheel(0, 3000);
    expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole("button", { name: "Toggle file list" }).click();
    await expect(tree).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
