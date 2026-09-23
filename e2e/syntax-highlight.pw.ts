import { test, expect } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

// the hunk starts well inside <script>, so only the file's leading context marks it as ts.
const SCRIPT_BODY = Array.from({ length: 12 }, (_, i) => `  const v${i} = ${i};`).join("\n");
const svelte = (value: number) => `<script lang="ts">\n${SCRIPT_BODY}\n  let count = $state(${value});\n</script>\n\n<p>{count}</p>\n`;

test("a mid-file svelte hunk highlights as script, not markup", async ({ page }) => {
  const fixture = makeFixture([{ path: "Counter.svelte", base: svelte(0), work: svelte(1) }]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    const added = page.locator("tr.row-addition td.code").filter({ hasText: "let count" });
    await expect(added.locator('span[style*="--syn-keyword"]').filter({ hasText: "let" })).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
