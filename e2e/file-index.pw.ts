import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

test("file index lists, filters, and selects changed files", async ({ page }) => {
  const fixture = makeFixture([
    { path: "src/alpha.ts", base: "export const a = 1;\n", work: "export const a = 2;\n" },
    { path: "docs/readme.md", base: "# hi\n", work: "# hello\n" },
  ]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    const index = page.getByRole("navigation", { name: "Changed files" });
    await expect(index).toBeVisible();
    await expect(index.getByText("alpha.ts")).toBeVisible();
    await expect(index.getByText("readme.md")).toBeVisible();

    // the filter narrows the list
    const filter = index.getByRole("searchbox", { name: /filter/i });
    await filter.fill("readme");
    await expect(index.getByText("readme.md")).toBeVisible();
    await expect(index.getByText("alpha.ts")).toHaveCount(0);

    // clearing restores both; selecting a file marks it active
    await filter.fill("");
    await index.getByRole("button", { name: /alpha\.ts/ }).click();
    await expect(index.getByRole("button", { name: /alpha\.ts/ })).toHaveAttribute("aria-current", "true");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
