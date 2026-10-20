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

test("warns when the server stops, blocks saving, and recovers on restart", async ({ page }) => {
  const fixture = makeFixture(FILES);
  const port = await freePort();
  const args = ["--port", String(port)];
  let { server, url } = startPreview(fixture, { seenWhatsNew: true, args });
  try {
    await gotoApp(page, await url);
    await expect(page.getByTestId("server-gone")).toHaveCount(0);
    await openEditor(page);
    const save = page.getByRole("button", { name: "Save" });
    await expect(save).toBeEnabled();

    await stop(server);

    const banner = page.getByRole("alert").filter({ hasText: "server is gone" });
    await expect(banner).toBeVisible({ timeout: BANNER_TIMEOUT_MS });
    await expect(banner).toContainText(`--port ${port}`);
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("title", /server is gone/i);

    ({ server, url } = startPreview(fixture, { seenWhatsNew: true, args }));
    await url;
    await expect(banner).toBeHidden({ timeout: BANNER_TIMEOUT_MS });
    await expect(save).toBeEnabled();
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
