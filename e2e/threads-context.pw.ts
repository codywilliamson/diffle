import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { makeFixture, startPreview, stop, cleanup, gotoApp } from "./harness";

// a 100-line plain-text file (no grammar, so each line renders as its own text) with lines 30
// and 80 changed: hunks cover 27–33 and 77–83, hiding 1–26, 34–76 and 84–100.
const base = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
const work = base.replace("line 30\n", "line 30 changed\n").replace("line 80\n", "line 80 changed\n");
const fixtureFiles = [{ path: "notes.txt", base, work }];

const codeLine = (page: Page, text: string) => page.locator(".code-inner", { hasText: new RegExp(`^${text}$`) });

async function commentOn(page: Page, line: number, text: string): Promise<void> {
  // the last match is the new-side row (a changed line also has an old-side deletion row)
  await page.getByRole("button", { name: `Comment on line ${line}`, exact: true }).last().click();
  await page.getByRole("textbox", { name: "Comment text" }).fill(text);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(text)).toBeVisible();
}

test("a resolved thread collapses to a pip on its line and opens again", async ({ page }) => {
  const fixture = makeFixture(fixtureFiles);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await commentOn(page, 30, "is this rename intended?");

    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(page.getByText("is this rename intended?")).toBeHidden();
    await expect(page.locator("tr.comment-row")).toHaveCount(0); // collapsed: no row at all
    const pip = page.getByRole("button", { name: "Show resolved thread (1 message)" });
    await expect(pip).toBeVisible();

    await pip.click();
    await expect(page.getByText("is this rename intended?")).toBeVisible();
    await page.getByRole("button", { name: "Hide thread" }).click();
    await expect(page.getByText("is this rename intended?")).toBeHidden();

    // split view collapses the same way
    await page.keyboard.press("s");
    await expect(page.getByRole("button", { name: "Show resolved thread (1 message)" })).toBeVisible();
    await expect(page.getByText("is this rename intended?")).toBeHidden();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("hidden context expands gitlab-style and a comment on it stays put", async ({ page }) => {
  const fixture = makeFixture(fixtureFiles);
  const { server, url } = startPreview(fixture);
  try {
    const app = await url;
    await gotoApp(page, app);
    await expect(codeLine(page, "line 50")).toHaveCount(0);

    // grow the first hunk 20 lines down (34–53), then comment on a revealed line
    await page.getByRole("button", { name: "Show 20 more lines below" }).first().click();
    await expect(codeLine(page, "line 50")).toBeVisible();
    await expect(codeLine(page, "line 54")).toHaveCount(0);
    await commentOn(page, 50, "this unchanged helper needs the same fix");

    // the trailing gap: everything after the last hunk
    await page.getByRole("button", { name: "Show all 17 hidden lines" }).click();
    await expect(codeLine(page, "line 100")).toBeVisible();

    // after a reload the expansion is gone, but the commented line is revealed again
    await page.reload();
    await expect(page.getByText("this unchanged helper needs the same fix")).toBeVisible();
    await expect(codeLine(page, "line 100")).toHaveCount(0);

    // the comment on expanded context reaches the agent's feedback
    const compiled = await page.request.get(`${new URL(app).origin}/api/compile`).then((r) => r.json()) as { prompt: string };
    expect(compiled.prompt).toContain("this unchanged helper needs the same fix");
    expect(compiled.prompt).toContain("> 50 |  line 50");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("a diff refresh keeps revealed lines and a draft typed on one", async ({ page }) => {
  const fixture = makeFixture(fixtureFiles);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await page.getByRole("button", { name: "Show 20 more lines below" }).first().click();
    await page.getByRole("button", { name: "Comment on line 50", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Comment text" });
    await editor.fill("half-written thought");

    const refreshed = page.waitForResponse((r) => r.url().endsWith("/api/diff"));
    await editor.blur(); // shortcuts ignore keys typed into a textbox
    await page.keyboard.press("r");
    await refreshed;
    await expect(codeLine(page, "line 50")).toBeVisible();
    await expect(editor).toHaveValue("half-written thought");
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("a comment on context past the file's new end goes stale instead of vanishing", async ({ page }) => {
  const fixture = makeFixture(fixtureFiles);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await page.getByRole("button", { name: "Show all 17 hidden lines" }).click();
    await commentOn(page, 95, "check the footer too");

    // the agent trims the file to 90 lines; both hunks survive
    writeFileSync(join(fixture, "notes.txt"), work.split("\n").slice(0, 90).join("\n") + "\n");
    const refreshed = page.waitForResponse((r) => r.url().endsWith("/api/diff"));
    await page.keyboard.press("r");
    await refreshed;
    await expect(page.getByText("From earlier reviews (1)")).toBeVisible();
    await expect(page.getByText("check the footer too")).toBeVisible();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("the threads panel lists threads and jumps to one", async ({ page }) => {
  const fixture = makeFixture(fixtureFiles);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await commentOn(page, 80, "second thought");
    await commentOn(page, 30, "first thought");
    await page.getByRole("button", { name: "Resolve", exact: true }).first().click(); // line 30's, in file order

    await page.keyboard.press("l");
    const panel = page.getByRole("dialog", { name: "Threads" });
    await expect(panel.getByText("second thought")).toBeVisible();
    await expect(panel.getByText("first thought")).toBeHidden(); // resolved, filtered out of "Open"
    await panel.getByRole("button", { name: /^Resolved/ }).click();
    await panel.getByText("first thought").click();

    await expect(panel).toBeHidden();
    const card = page.locator("[data-comment-id]", { hasText: "first thought" });
    await expect(card).toBeVisible(); // the jump expanded the collapsed thread
    await expect(card).toBeInViewport();
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});

test("a review poll does not re-render the code", async ({ page }) => {
  const fixture = makeFixture([{ path: "values.ts", base: "const a = compute(1);\nconst b = compute(2);\n", work: "const a = computeFast(1);\nconst b = compute(2);\n" }]);
  const { server, url } = startPreview(fixture);
  try {
    await gotoApp(page, await url);
    await expect(page.locator(".code-inner span").first()).toBeVisible(); // highlighted
    // the review store polls every 3s; watch the code cells across more than one poll
    const rewrites = await page.evaluate(async () => {
      let count = 0;
      const observer = new MutationObserver((list) => {
        count += list.filter((m) => (m.target as Element).closest?.(".code-inner")).length;
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      await new Promise((resolve) => setTimeout(resolve, 3500));
      observer.disconnect();
      return count;
    });
    expect(rewrites).toBe(0);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
});
