// drives the real diffle app through one review and screenshots each scene into
// public/captures/<id>.png. remotion then composites those frames — nothing here is
// hand-authored UI. run with node (tsx), never bun (playwright+bun+windows hangs).
import { chromium, type Page } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFixture, startBackend, stop, cleanup } from "./lib/backend";
import { FIXTURE, COMMENT_FILE, COMMENT_LINE, COMMENT_TEXT, REVIEW_SUMMARY } from "./lib/fixture";
import { WIDTH, HEIGHT } from "./scenes";

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURES = join(HERE, "..", "public", "captures");

async function shot(page: Page, id: string): Promise<void> {
  await page.waitForTimeout(250); // let any settle finish before the frame
  await page.screenshot({ path: join(CAPTURES, `${id}.png`) });
  console.log(`captured ${id}`);
}

async function dismissWhatsNew(page: Page): Promise<void> {
  await page
    .getByRole("dialog", { name: /What's new/ })
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => page.keyboard.press("Escape"))
    .catch(() => {});
}

async function run(): Promise<void> {
  rmSync(CAPTURES, { recursive: true, force: true });
  mkdirSync(CAPTURES, { recursive: true });

  const fixture = makeFixture(FIXTURE);
  const { server, url } = startBackend(fixture);
  const browser = await chromium.launch();
  try {
    const reviewUrl = await url;
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.goto(reviewUrl);
    await dismissWhatsNew(page);

    // 1 — overview: the diff loaded, file index populated
    await page.getByRole("navigation", { name: "Changed files" }).waitFor();
    await page.getByText(/@@ .* @@/).first().waitFor();
    await shot(page, "overview");

    // 2 — comment: open the inline composer on a changed line in server.ts and type.
    // scope to that file's section — other files share the same line number.
    const serverSection = page.locator("section.file-section", { has: page.getByText(COMMENT_FILE) });
    await serverSection.getByRole("button", { name: new RegExp(`Comment on line ${COMMENT_LINE}`) }).first().click();
    const editor = page.getByRole("textbox", { name: "Comment text" });
    await editor.fill(COMMENT_TEXT);
    await shot(page, "comment");

    // 3 — thread: save it; the thread now hangs off the line
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText(COMMENT_TEXT).waitFor();
    await shot(page, "thread");

    // 4 — side-by-side: same review, split layout
    await page.getByRole("button", { name: "Side-by-side view", exact: true }).click();
    await page.locator("table.split-table").first().waitFor();
    await shot(page, "side-by-side");

    // 5 — summary: toggle split back off (unified), open the review menu, summarize
    await page.getByRole("button", { name: "Side-by-side view", exact: true }).click();
    await page.locator("table.split-table").first().waitFor({ state: "detached" });
    await page.getByRole("button", { name: /Review menu/ }).click();
    await page.getByRole("textbox", { name: "Reviewer summary" }).fill(REVIEW_SUMMARY);
    await shot(page, "summary");

    // 6 — feedback: open the structured feedback preview
    await page.getByRole("button", { name: "Preview feedback" }).click();
    await page.getByRole("dialog", { name: /Feedback preview/ }).waitFor();
    await shot(page, "feedback");
  } finally {
    await browser.close();
    await stop(server);
    cleanup(fixture);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
