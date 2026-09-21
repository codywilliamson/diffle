import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

test("add, edit, and resolve a line comment", async ({ page }) => {
  const fixture = makeFixture([
    { path: "app.ts", base: "const x = 1;\nconst y = 2;\n", work: "const x = 10;\nconst y = 2;\n" },
  ]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);

    // a click on the bubble commits a single-line selection and opens the editor
    await page.getByRole("button", { name: /Comment on line 1/ }).first().click();
    const editor = page.getByRole("textbox", { name: "Comment text" });
    await editor.fill("please double-check this");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("please double-check this")).toBeVisible();

    // edit it
    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("textbox", { name: "Comment text" });
    await edit.fill("actually looks fine");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("actually looks fine")).toBeVisible();

    // resolve it (exact — "unresolved" in the review trigger would otherwise collide)
    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
