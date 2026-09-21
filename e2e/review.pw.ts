import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

test("review panel returns feedback and reflects the new status", async ({ page }) => {
  const fixture = makeFixture([{ path: "a.ts", base: "const x = 1;\n", work: "const x = 2;\n" }]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);

    await expect(page.getByRole("button", { name: /Review menu — Ready/ })).toBeVisible();
    await page.getByRole("button", { name: /Review menu/ }).click();
    await page.getByRole("textbox", { name: "Reviewer summary" }).fill("looks good overall");
    await page.getByRole("button", { name: "Return Feedback" }).click();

    await expect(page.getByRole("button", { name: /Review menu — Feedback sent/ })).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
