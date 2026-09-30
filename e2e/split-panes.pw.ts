import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";
import { PRODUCT } from "../src/core/product";

const LONG_OLD = `  message: "${"old content\t".repeat(45)}",`;
const LONG_NEW = `  message: "${"new content 界".repeat(55)}",`;
const BASE = ["export const options = {", LONG_OLD, "  retries: 3,", "  enabled: true,", "};", ""].join("\n");
const WORK = ["export const options = {", LONG_NEW, "  retries: 5,", "  enabled: false,", "  timeout: 5000,", "};", ""].join("\n");

async function aligned(page: Page): Promise<void> {
  await expect.poll(() => page.locator(".split-pane").evaluateAll((panes) => {
    const rows = panes.map((pane) => Array.from(pane.querySelectorAll(".split-line, .split-comment-slot")).map((row) => {
      const rect = row.getBoundingClientRect();
      return [rect.y, rect.height];
    }));
    return rows[0]!.length === rows[1]!.length && rows[0]!.every((rect, i) => rect.every((n, j) => Math.abs(n - rows[1]![i]![j]!) < 1));
  })).toBe(true);
}

for (const theme of ["dark", "light"]) for (const width of [1440, 390]) {
  test(`split panes scroll, wrap, resize and comment at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(({ prefix, theme }) => {
      localStorage.setItem(`${prefix}-theme`, theme);
      localStorage.setItem(`${prefix}-split`, "true");
      localStorage.setItem(`${prefix}-split-ratio`, "50");
    }, { prefix: PRODUCT.name, theme });
    const fixture = makeFixture([{ path: "options.ts", base: BASE, work: WORK }]);
    const { server, url } = startPreview(fixture);
    try {
      await gotoApp(page, await url);
      const old = page.getByRole("region", { name: "Old version of options.ts", exact: true });
      const fresh = page.getByRole("region", { name: "New version of options.ts", exact: true });
      const divider = page.getByRole("separator", { name: "Old version pane width" });
      await expect(old).toBeVisible();
      await expect(fresh).toBeVisible();
      await aligned(page);
      expect(await page.locator(".diff-scroll").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);

      // native horizontal trackpad movement and shift+wheel affect only the hovered side.
      await old.hover();
      await page.mouse.wheel(280, 0);
      await expect.poll(() => old.evaluate((node) => node.scrollLeft)).toBeGreaterThan(100);
      expect(await fresh.evaluate((node) => node.scrollLeft)).toBe(0);
      await fresh.hover();
      await page.keyboard.down("Shift");
      await page.mouse.wheel(0, 280);
      await page.keyboard.up("Shift");
      await expect.poll(() => fresh.evaluate((node) => node.scrollLeft)).toBeGreaterThan(100);

      // gutters and a keyboard-opened composer stay visible after scrolling.
      const bubble = page.getByRole("button", { name: "Comment on old line 2", exact: true });
      await expect(bubble).toBeInViewport();
      await expect(page.getByRole("button", { name: "Select old line 4", exact: true })).toBeInViewport();
      await expect(page.getByRole("button", { name: "Select new line 4", exact: true })).toBeInViewport();
      await bubble.press("Enter");
      await page.getByRole("button", { name: "Comment on old line 4", exact: true }).click({ modifiers: ["Shift"] });
      await expect(old.locator(".range-selected")).toHaveCount(3);
      await expect(fresh.locator(".range-selected")).toHaveCount(0);
      const editor = page.getByRole("textbox", { name: "Comment text" });
      await editor.fill("Keep the old-side range visible while inspecting long code.");
      await expect(editor).toBeInViewport();
      await aligned(page);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(old.getByText("Keep the old-side range visible while inspecting long code.")).toBeVisible();
      await expect(fresh.locator(".in-range")).toHaveCount(0);
      await page.getByRole("button", { name: "Comment on new line 4", exact: true }).press("Enter");
      await editor.fill("Check the replacement too.");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await aligned(page);

      // unequal widths + wrapping + differently sized threads must keep the next row aligned.
      await divider.press("ArrowRight");
      await expect(divider).toHaveAttribute("aria-valuenow", "52");
      await divider.press("Shift+ArrowRight");
      await expect(divider).toHaveAttribute("aria-valuenow", "62");
      await page.keyboard.press("w");
      await expect(page.locator(".wrap")).toBeVisible();
      await expect.poll(() => old.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await expect.poll(() => fresh.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await aligned(page);
      await divider.press("Enter");
      await expect(divider).toHaveAttribute("aria-valuenow", "50");
      const box = await divider.boundingBox();
      const root = await page.locator(".split-diff").boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + 12);
      await page.mouse.down();
      await page.mouse.move(root!.x + root!.width * 0.6, box!.y + 12, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => Number(await divider.getAttribute("aria-valuenow"))).toBeGreaterThan(55);
      await aligned(page);
      await divider.dblclick();
      await expect(divider).toHaveAttribute("aria-valuenow", "50");
      await divider.press("Home");
      await aligned(page);
      expect(await fresh.evaluate((node) => node.clientWidth)).toBeGreaterThanOrEqual(119);
      await divider.press("End");
      expect(await old.evaluate((node) => node.clientWidth)).toBeGreaterThanOrEqual(119);
      await divider.press("Enter");
      await page.screenshot({ path: `test-results/split-${width}-${theme}.png`, fullPage: true });
    } finally {
      await stop(server);
      cleanup(fixture);
    }
  });
}

test("split range dragging, wheel edges, cancellation and saved divider width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const base = [LONG_OLD, ...Array.from({ length: 80 }, (_, i) => `const value${i} = ${i};`), ""].join("\n");
  const work = [LONG_NEW, ...Array.from({ length: 80 }, (_, i) => `const value${i} = ${i + 1};`), ""].join("\n");
  const fixture = makeFixture([{ path: "long.ts", base, work }]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await page.getByRole("button", { name: "Side-by-side view", exact: true }).click();
    const old = page.getByRole("region", { name: "Old version of long.ts", exact: true });
    const fresh = page.getByRole("region", { name: "New version of long.ts", exact: true });
    const divider = page.getByRole("separator", { name: "Old version pane width" });
    const start = await page.getByRole("button", { name: "Select new line 2", exact: true }).boundingBox();
    const finish = await page.getByRole("button", { name: "Select new line 4", exact: true }).boundingBox();
    await page.mouse.move(start!.x + 5, start!.y + 5);
    await page.mouse.down();
    await page.mouse.move(finish!.x + 5, finish!.y + 5);
    await page.mouse.up();
    await expect(fresh.locator(".range-selected")).toHaveCount(3);
    await expect(old.locator(".range-selected")).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    // a synthetic wheel exposes preventDefault directly, including line/page delta modes.
    expect(await old.evaluate((node) => {
      node.scrollLeft = 0;
      const backward = new WheelEvent("wheel", { shiftKey: true, deltaY: -120, bubbles: true, cancelable: true });
      node.dispatchEvent(backward);
      const forward = new WheelEvent("wheel", { shiftKey: true, deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true });
      node.dispatchEvent(forward);
      const moved = node.scrollLeft;
      node.scrollLeft = node.scrollWidth;
      const edge = new WheelEvent("wheel", { shiftKey: true, deltaY: 120, bubbles: true, cancelable: true });
      node.dispatchEvent(edge);
      return { backward: backward.defaultPrevented, forward: forward.defaultPrevented, edge: edge.defaultPrevented, moved };
    })).toEqual({ backward: false, forward: true, edge: false, moved: 60 });
    await divider.press("Shift+ArrowRight");
    await expect(divider).toHaveAttribute("aria-valuenow", "60");
    await page.reload();
    await expect(divider).toHaveAttribute("aria-valuenow", "60");
    const box = await divider.boundingBox();
    await page.mouse.move(box!.x + 4, box!.y + 12);
    await page.mouse.down();
    await divider.dispatchEvent("pointercancel", { pointerId: 1 });
    await page.mouse.up();
    await expect(page.locator(".split-diff")).not.toHaveClass(/resizing/);
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(() => fresh.evaluate((node) => node.clientWidth)).toBeGreaterThanOrEqual(119);
    await aligned(page);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
