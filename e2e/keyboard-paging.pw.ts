import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const lines = (count: number, text: (n: number) => string): string =>
  Array.from({ length: count }, (_, i) => text(i + 1)).join("\n") + "\n";

async function open(page: Page, url: Promise<string>): Promise<void> {
  await gotoApp(page, await url);
  await expect(page.locator("tr.diff-row").first()).toBeVisible();
}

test("Esc closes an open editor and also clears a pending count", async ({ page }) => {
  const fixture = makeFixture([{ path: "a.ts", base: lines(10, (n) => `line ${n}`), work: lines(10, (n) => (n === 5 ? "LINE 5" : `line ${n}`)) }]);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("5");
    await page.getByRole("button", { name: "Comment on a.ts" }).click();
    const box = page.getByRole("textbox", { name: "Comment text" });
    await box.focus();
    await page.keyboard.press("Escape");
    await expect(box).toHaveCount(0);
    // the count died with the editor, so j moves one line
    await page.keyboard.press("j");
    await expect(page.locator("[data-cursor]")).toHaveAttribute("data-newline", "2");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("Ctrl+d and Ctrl+u move half a viewport in pixels with wrapping and an inline comment", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  const longTail = " word".repeat(70);
  const fixture = makeFixture([{
    path: "wrap.ts",
    base: lines(150, (n) => `line ${n}`),
    work: lines(150, (n) => `LINE ${n}${n % 5 === 0 ? longTail : ""}`),
  }]);
  const { server, url } = startPreview(fixture, { seenWhatsNew: true });
  try {
    await open(page, url);
    await page.keyboard.press("w");
    await page.getByRole("button", { name: /Comment on line 3/ }).first().click();
    await page.getByRole("textbox", { name: "Comment text" }).fill("a note between the rows");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("a note between the rows")).toBeVisible();

    // the cursor row's offset inside the scrolled diff, so scrolling does not change the answer
    const docY = (): Promise<{ y: number; half: number }> =>
      page.evaluate(() => {
        const pane = document.querySelector<HTMLElement>("[data-diff-pane]")!;
        const row = document.querySelector("[data-cursor]")!.getBoundingClientRect();
        return { y: row.top + pane.scrollTop - pane.getBoundingClientRect().top, half: pane.clientHeight / 2 };
      });
    const ROW_TOLERANCE_PX = 140; // the tallest wrapped row

    await page.keyboard.type("gg");
    const start = await docY();
    await page.keyboard.press("Control+d");
    const down = await docY();
    expect(Math.abs(down.y - start.y - down.half)).toBeLessThan(ROW_TOLERANCE_PX);
    await page.keyboard.press("Control+u");
    const up = await docY();
    expect(Math.abs(up.y - down.y + down.half)).toBeLessThan(ROW_TOLERANCE_PX);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
