import { createServer } from "node:net";
import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

const BANNER_TIMEOUT_MS = 10_000;
const SHOTS_DIR = process.env.SERVER_GONE_SHOTS;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

const FILES = [{ path: "app.ts", base: "const x = 1;\n", work: "const x = 10;\n" }];

async function openEditor(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Comment on line 1/ }).first().click();
  await page.getByRole("textbox", { name: "Comment text" }).fill("draft stays put");
}

const reviewIdOf = (url: string): string => new URL(url).searchParams.get("review") ?? "";

test("warns when the server stops, blocks writes, and recovers when the same review returns", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const port = await freePort();
  const args = ["--port", String(port)];
  let { server, url } = startPreview(fixture, { seenWhatsNew: true, args });
  try {
    const first = await url;
    const reviewId = reviewIdOf(first);
    await gotoApp(page, first);
    await expect(page.getByTestId("server-gone")).toHaveCount(0);

    // one saved comment, then an open editor with unsent text
    await openEditor(page);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("draft stays put")).toBeVisible();
    await openEditor(page);
    const save = page.getByRole("button", { name: "Save" });
    await expect(save).toBeEnabled();

    await stop(server);

    const banner = page.getByTestId("server-gone");
    await expect(banner).toBeVisible({ timeout: BANNER_TIMEOUT_MS });
    await expect(banner).toHaveAttribute("role", "alert");
    await expect(banner).toContainText(`--review-id ${reviewId} --port ${port}`);
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("title", /server is gone/i);
    await expect(page.getByRole("button", { name: "Resolve", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Delete" })).toBeDisabled();

    // the same review comes back: recover, keep the unsent text, banner gone
    ({ server, url } = startPreview(fixture, { seenWhatsNew: true, args: [...args, "--review-id", reviewId] }));
    await url;
    await expect(banner).toBeHidden({ timeout: BANNER_TIMEOUT_MS });
    await expect(save).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "Comment text" })).toHaveValue("draft stays put");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("a different review on the same port stays blocked until the page is reloaded", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const port = await freePort();
  const args = ["--port", String(port)];
  let { server, url } = startPreview(fixture, { seenWhatsNew: true, args });
  try {
    const first = await url;
    await gotoApp(page, first);
    await openEditor(page);
    const save = page.getByRole("button", { name: "Save" });

    await stop(server);
    await expect(page.getByTestId("server-gone")).toBeVisible({ timeout: BANNER_TIMEOUT_MS });

    // no --review-id: this starts a brand new review on the same origin
    let second: string;
    ({ server, url } = startPreview(fixture, { seenWhatsNew: true, args }));
    second = await url;
    expect(reviewIdOf(second)).not.toBe(reviewIdOf(first));

    const banner = page.getByTestId("server-mismatch");
    await expect(banner).toBeVisible({ timeout: BANNER_TIMEOUT_MS });
    await expect(banner).toContainText("A different review is running on this port");
    await expect(save).toBeDisabled();
    await page.waitForTimeout(4_000);
    await expect(banner).toBeVisible();
    await expect(save).toBeDisabled();

    await banner.getByRole("link", { name: /Reload/ }).click();
    await expect(page).toHaveURL(new RegExp(`review=${reviewIdOf(second)}`));
    await expect(page.getByTestId("server-mismatch")).toHaveCount(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

for (const scheme of ["light", "dark"] as const) {
  for (const [label, viewport] of [["desktop", DESKTOP], ["phone", PHONE]] as const) {
    test(`banner screenshot ${scheme} ${label}`, async ({ browser }) => {
      test.skip(!SHOTS_DIR, "set SERVER_GONE_SHOTS to capture");
      const context = await browser.newContext({ colorScheme: scheme, viewport });
      const page = await context.newPage();
      const fixture = makeFixture(FILES);
      const { server, url } = startPreview(fixture, { seenWhatsNew: true });
      try {
        await gotoApp(page, await url);
        await stop(server);
        await expect(page.getByTestId("server-gone")).toBeVisible({ timeout: BANNER_TIMEOUT_MS });
        await page.screenshot({ path: `${SHOTS_DIR}/server-gone-${scheme}-${label}.png` });
      } finally {
        await stop(server);
        cleanup(fixture);
        await context.close();
      }
    });
  }
}
