import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";
import { PRODUCT } from "../src/core/product";

test("chosen pane widths return after viewport and sidebar constraints relax", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = makeFixture([{
    path: "app.ts",
    base: "const value = 1;\n",
    work: "const value = 2;\n",
  }]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await page.getByRole("button", { name: "Side-by-side view", exact: true }).click();
    const divider = page.getByRole("separator", { name: "Old version pane width" });
    const ratioKey = `${PRODUCT.name}-split-ratio`;

    for (const { key, ratio } of [{ key: "End", ratio: 80 }, { key: "Home", ratio: 20 }]) {
      await divider.press(key);
      await expect(divider).toHaveAttribute("aria-valuenow", String(ratio));
      await page.setViewportSize({ width: 390, height: 900 });
      await expect.poll(async () => Number(await divider.getAttribute("aria-valuenow"))).not.toBe(ratio);
      expect(await page.evaluate((key) => localStorage.getItem(key), ratioKey)).toBe(String(ratio));

      // remount while constrained, then widen without remounting again.
      await page.reload();
      await expect.poll(async () => Number(await divider.getAttribute("aria-valuenow"))).not.toBe(ratio);
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(divider).toHaveAttribute("aria-valuenow", String(ratio));
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await divider.press("End");
    await expect(divider).toHaveAttribute("aria-valuenow", "80");
    const sidebar = page.getByRole("separator", { name: "Resize sidebar" });
    const handle = (await sidebar.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 12);
    await page.mouse.down();
    await page.mouse.move(640, handle.y + 12, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => Number(await divider.getAttribute("aria-valuenow"))).toBeLessThan(80);
    expect(await page.evaluate((key) => localStorage.getItem(key), ratioKey)).toBe("80");

    const expandedHandle = (await sidebar.boundingBox())!;
    await page.mouse.move(expandedHandle.x + expandedHandle.width / 2, expandedHandle.y + 12);
    await page.mouse.down();
    await page.mouse.move(280, expandedHandle.y + 12, { steps: 10 });
    await page.mouse.up();
    await expect(divider).toHaveAttribute("aria-valuenow", "80");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
