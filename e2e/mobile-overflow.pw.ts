import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

test("phone top bar keeps every review tool reachable without page overflow", async ({ page }) => {
  const fixture = makeFixture([
    { path: "src/really-long-mobile-file-name.ts", base: "export const value = 1;\n", work: "export const value = 2;\n" },
  ]);
  const { server, url } = startPreview(fixture);
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoApp(page, await url);

    const more = page.getByRole("button", { name: "More tools" });
    const desktopSplit = page.locator("header").getByRole("button", { name: "Side-by-side view", exact: true });
    await expect(more).toBeVisible();
    await expect(page.getByRole("button", { name: /Review menu/ })).toBeVisible();
    await expect(desktopSplit).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await more.click();
    const menu = page.getByRole("menu", { name: "More tools" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: /Wrap lines/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();
    await expect(page.locator(".wrap").first()).toBeVisible();

    await more.click();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();

    const initialTheme = await page.locator("html").getAttribute("data-theme");
    await more.click();
    await menu.getByRole("menuitem", { name: /Toggle theme/ }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", initialTheme ?? "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(more).toBeHidden();
    await expect(desktopSplit).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
