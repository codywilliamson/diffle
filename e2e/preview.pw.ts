import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

test("production preview serves the svelte client with a real diff", async ({ page }) => {
  const fixture = makeFixture([{ path: "greeting.ts", base: "export const hello = 'hi';\n", work: "export const hello = 'hello there';\n" }]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await expect(page.getByText("diffle", { exact: true })).toBeVisible();
    await expect(page.getByText(/1 file\b/)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Changed files" })).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
