import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup } from "./harness";

test("large files hide behind a manual load gate", async ({ page }) => {
  const big = Array.from({ length: 2100 }, (_, i) => `line ${i}`).join("\n") + "\n";
  const fixture = makeFixture([{ path: "big.txt", base: "seed\n", work: big }]);
  const { server, url } = startPreview(fixture);
  try {
    await page.goto(await url);
    await expect(page.getByText(/Large diff/)).toBeVisible();
    await expect(page.locator("td.code").filter({ hasText: "line 500" })).toHaveCount(0);

    await page.getByRole("button", { name: "Load diff" }).click();
    await expect(page.locator("td.code").filter({ hasText: "line 500" }).first()).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
