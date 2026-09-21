// a curated, high-res screenshot set for the docs site — drives the real app to each key state
// and captures it at 1440x900 @2x. writes to public/shots/ (gitignored); copy the finals to
// docs/screenshots/ for the docs to consume. node/tsx only.
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFixture, startBackend, stop, cleanup, type FixtureFile } from "./lib/backend";
import {
  FIXTURE, BIG_FIXTURE, COMMENT_FILE, COMMENT_LINE, COMMENT_TEXT, REVIEW_SUMMARY,
  RANGE_START, RANGE_END, RANGE_TEXT,
} from "./lib/fixture";

const W = 1440;
const H = 900;
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "..", "public", "shots");

interface Session {
  page: Page;
  teardown: () => Promise<void>;
}

async function open(browser: Browser, files: FixtureFile[]): Promise<Session> {
  const fixture = makeFixture(files);
  const { server, url } = startBackend(fixture);
  const reviewUrl = await url;
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.goto(reviewUrl);
  await page
    .getByRole("dialog", { name: /What's new/ })
    .waitFor({ state: "visible", timeout: 1500 })
    .then(() => page.keyboard.press("Escape"))
    .catch(() => {});
  return {
    page,
    teardown: async () => {
      await context.close();
      await stop(server);
      cleanup(fixture);
    },
  };
}

async function shoot(page: Page, id: string): Promise<void> {
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `${id}.png`) });
  console.log(`shot ${id}`);
}

function serverBubble(page: Page, line: number) {
  const section = page.locator("section.file-section", { has: page.getByText(COMMENT_FILE) });
  return section.getByRole("button", { name: new RegExp(`Comment on line ${line}`) }).first();
}

async function run(): Promise<void> {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  try {
    // ── main small-fixture flow ────────────────────────────────────────────
    {
      const { page, teardown } = await open(browser, FIXTURE);
      await page.getByText(/@@ .* @@/).first().waitFor();
      await shoot(page, "overview-dark");

      await serverBubble(page, COMMENT_LINE).click();
      await page.getByRole("textbox", { name: "Comment text" }).fill(COMMENT_TEXT);
      await shoot(page, "inline-comment");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByText(COMMENT_TEXT).waitFor();
      await shoot(page, "comment-thread");

      await page.getByRole("button", { name: "Side-by-side view" }).click();
      await page.locator("table.split-table").first().waitFor();
      await shoot(page, "side-by-side");
      await page.getByRole("button", { name: "Side-by-side view" }).click();
      await page.locator("table.split-table").first().waitFor({ state: "detached" });

      const md = page.locator("section.file-section", { has: page.getByText("README.md") });
      await md.getByRole("button", { name: "Toggle rendered preview" }).first().click();
      await page.locator(".markdown-body").first().waitFor();
      await shoot(page, "markdown-preview");
      await md.getByRole("button", { name: "Toggle rendered preview" }).first().click();

      await page.getByRole("button", { name: /Review menu/ }).click();
      await page.getByRole("textbox", { name: "Reviewer summary" }).fill(REVIEW_SUMMARY);
      await shoot(page, "review-panel");
      await page.getByRole("button", { name: "Preview feedback" }).click();
      await page.getByRole("dialog", { name: /Feedback preview/ }).waitFor();
      await shoot(page, "feedback-export");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: /^Theme:/ }).click();
      await page.waitForTimeout(450);
      await shoot(page, "overview-light");
      await page.getByRole("button", { name: /^Theme:/ }).click();
      await page.waitForTimeout(300);

      await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
      await page.getByRole("dialog").first().waitFor();
      await shoot(page, "shortcuts");
      await teardown();
    }

    // ── clean multi-line range comment ─────────────────────────────────────
    {
      const { page, teardown } = await open(browser, FIXTURE);
      await page.getByText(/@@ .* @@/).first().waitFor();
      const a = await serverBubble(page, RANGE_START).boundingBox();
      const b = await serverBubble(page, RANGE_END).boundingBox();
      if (a && b) {
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.getByRole("textbox", { name: "Comment text" }).fill(RANGE_TEXT);
        await shoot(page, "range-comment");
      }
      await teardown();
    }

    // ── big file tree (filter + depth) ─────────────────────────────────────
    {
      const { page, teardown } = await open(browser, BIG_FIXTURE);
      const nav = page.getByRole("navigation", { name: "Changed files" });
      await nav.waitFor();
      await page.getByText(/@@ .* @@/).first().waitFor();
      await shoot(page, "file-tree");
      await nav.getByRole("searchbox", { name: /filter/i }).fill("route");
      await page.waitForTimeout(350);
      await shoot(page, "file-tree-filter");
      await teardown();
    }
  } finally {
    await browser.close();
  }
  console.log("\ndone — screenshots in public/shots/");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
