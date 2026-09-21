// one driver per take: scripts real interactions on the live app and returns the zoom windows +
// captions (timed from t0, measured via ctx.since). record.ts runs each in its own recording.
import type { Page, Locator } from "playwright";
import type { ZoomSegment, Caption, Rect } from "./meta";
import { COMMENT_FILE, COMMENT_LINE, COMMENT_TEXT, REVIEW_SUMMARY } from "./lib/fixture";

export interface DriverCtx {
  page: Page;
  since: () => number;
  glideTo: (l: Locator) => Promise<void>;
  // note: glideTo takes a single locator; the page is closed over by record.ts.
  beat: (ms?: number) => Promise<void>;
}

export interface DriverResult {
  zooms: ZoomSegment[];
  captions: Caption[];
}

export interface Driver {
  id: string;
  run: (ctx: DriverCtx) => Promise<DriverResult>;
}

const pad = (r: Rect, m: number): Rect => ({ x: r.x - m, y: r.y - m, width: r.width + m * 2, height: r.height + m * 2 });

function serverSection(page: Page): Locator {
  return page.locator("section.file-section", { has: page.getByText(COMMENT_FILE) });
}

// shared: open the composer on the changed line and type a comment. returns the composer rect.
async function addComment(ctx: DriverCtx, text: string): Promise<Rect> {
  const { page, glideTo, beat } = ctx;
  const bubble = serverSection(page).getByRole("button", { name: new RegExp(`Comment on line ${COMMENT_LINE}`) }).first();
  await glideTo(bubble);
  await beat(400);
  await bubble.click();
  const editor = page.getByRole("textbox", { name: "Comment text" });
  await editor.waitFor();
  const rect = (await editor.boundingBox()) as Rect;
  await glideTo(editor);
  await editor.click();
  await beat(250);
  await editor.pressSequentially(text, { delay: 36 });
  await beat(500);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText(text).waitFor();
  return rect;
}

export const DRIVERS: Driver[] = [
  {
    id: "comment",
    run: async (ctx) => {
      const { since, beat } = ctx;
      const captions: Caption[] = [{ text: "Comment on any line — or a range, or a whole file", fromSec: 0.6, toSec: 99 }];
      const inSec = since();
      const rect = await addComment(ctx, COMMENT_TEXT);
      const outSec = since();
      await beat(1400);
      captions[0].toSec = since();
      return { zooms: [{ rect: pad(rect, 6), inSec, outSec }], captions };
    },
  },
  {
    id: "modes",
    run: async (ctx) => {
      const { page, since, glideTo, beat } = ctx;
      const captions: Caption[] = [];
      captions.push({ text: "Read it your way — unified…", fromSec: 0.4, toSec: 0 });
      await beat(700);
      captions[0].toSec = since();

      const split = page.getByRole("button", { name: "Side-by-side view" });
      await glideTo(split);
      await beat(300);
      await split.click();
      await page.locator("table.split-table").first().waitFor();
      captions.push({ text: "…or side-by-side", fromSec: since(), toSec: 0 });
      await beat(1400);

      const wrap = page.getByRole("button", { name: "Wrap lines" });
      await glideTo(wrap);
      await beat(200);
      await wrap.click();
      await beat(1000);
      captions[1].toSec = since();

      await split.click(); // back to unified
      await page.locator("table.split-table").first().waitFor({ state: "detached" });
      await beat(900);
      return { zooms: [], captions };
    },
  },
  {
    id: "review",
    run: async (ctx) => {
      const { page, since, glideTo, beat } = ctx;
      const captions: Caption[] = [];

      captions.push({ text: "Leave your review notes", fromSec: 0.5, toSec: 0 });
      await addComment(ctx, COMMENT_TEXT);
      await beat(600);
      captions[0].toSec = since();

      const menu = page.getByRole("button", { name: /Review menu/ });
      await glideTo(menu);
      await beat(200);
      await menu.click();
      const summary = page.getByRole("textbox", { name: "Reviewer summary" });
      await summary.waitFor();
      await glideTo(summary);
      await summary.click();
      await beat(200);
      await summary.pressSequentially(REVIEW_SUMMARY, { delay: 34 });
      await beat(700);

      captions.push({ text: "Export structured feedback for your agent", fromSec: since(), toSec: 0 });
      const preview = page.getByRole("button", { name: "Preview feedback" });
      await glideTo(preview);
      await beat(200);
      await preview.click();
      const dialog = page.getByRole("dialog", { name: /Feedback preview/ });
      await dialog.waitFor();
      const zoomIn = since();
      const rect = (await dialog.boundingBox()) as Rect;
      await beat(2200);
      captions[1].toSec = since();
      return { zooms: [{ rect: pad(rect, 4), inSec: zoomIn, outSec: since() }], captions };
    },
  },
  {
    id: "filetree",
    run: async (ctx) => {
      const { page, since, glideTo, beat } = ctx;
      const nav = page.getByRole("navigation", { name: "Changed files" });
      const filter = nav.getByRole("searchbox", { name: /filter/i });
      const captions: Caption[] = [{ text: "Filter and jump around large diffs", fromSec: 0.5, toSec: 0 }];

      const rect = (await nav.boundingBox()) as Rect;
      const zoomIn = since();
      await glideTo(filter);
      await beat(300);
      await filter.click();
      await filter.pressSequentially("rate", { delay: 90 });
      await beat(1100);
      await filter.fill("");
      await beat(600);
      const zoomOut = since();

      const readme = nav.getByRole("button", { name: /README\.md/ });
      await glideTo(readme);
      await beat(200);
      await readme.click();
      await beat(500);
      await page.keyboard.press("v"); // mark viewed
      await beat(1100);
      captions[0].toSec = since();
      return { zooms: [{ rect: { x: rect.x, y: rect.y, width: rect.width, height: Math.min(rect.height, 360) }, inSec: zoomIn, outSec: zoomOut, scale: 1.9 }], captions };
    },
  },
];
