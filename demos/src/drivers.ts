// one driver per take: scripts real interactions on the live app and returns the zoom windows +
// captions (timed from t0, measured via ctx.since). record.ts runs each in its own recording.
import type { Page, Locator } from "playwright";
import type { ZoomSegment, Caption, Rect } from "./meta";
import type { FixtureFile } from "./lib/backend";
import {
  COMMENT_FILE, COMMENT_LINE, COMMENT_TEXT, REVIEW_SUMMARY,
  RANGE_START, RANGE_END, RANGE_TEXT, BIG_FIXTURE,
} from "./lib/fixture";

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
  fixture?: FixtureFile[]; // defaults to the focused rate-limiter FIXTURE in record.ts
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
    id: "range",
    run: async (ctx) => {
      const { page, since, glideTo, beat } = ctx;
      const captions: Caption[] = [{ text: "Comment on a range — drag across the line numbers", fromSec: 0.6, toSec: 0 }];
      const section = serverSection(page);
      const startBubble = section.getByRole("button", { name: new RegExp(`Comment on line ${RANGE_START}`) }).first();
      const endBubble = section.getByRole("button", { name: new RegExp(`Comment on line ${RANGE_END}`) }).first();
      const a = (await startBubble.boundingBox()) as Rect;
      const b = (await endBubble.boundingBox()) as Rect;

      const inSec = since();
      // press on the first line's gutter and drag down across the range, then release to open the composer
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 20 });
      await beat(450);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 26 });
      await beat(350);
      await page.mouse.up();

      const editor = page.getByRole("textbox", { name: "Comment text" });
      await editor.waitFor();
      const e = (await editor.boundingBox()) as Rect;
      await glideTo(editor);
      await editor.click();
      await beat(200);
      await editor.pressSequentially(RANGE_TEXT, { delay: 34 });
      await beat(500);
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByText(RANGE_TEXT).waitFor();
      const outSec = since();
      await beat(1400);
      captions[0].toSec = since();

      // zoom to span the selected lines through the composer
      const rect: Rect = { x: e.x, y: a.y - 8, width: e.width, height: e.y + e.height - a.y + 16 };
      return { zooms: [{ rect, inSec, outSec, scale: 1.5 }], captions };
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
    fixture: BIG_FIXTURE,
    run: async (ctx) => {
      const { page, since, glideTo, beat } = ctx;
      const nav = page.getByRole("navigation", { name: "Changed files" });
      const filter = nav.getByRole("searchbox", { name: /filter/i });
      const captions: Caption[] = [{ text: "Filter and scroll large diffs — jump to any file", fromSec: 0.6, toSec: 0 }];

      const rect = (await nav.boundingBox()) as Rect;
      const zoomIn = since();
      await glideTo(filter);
      await beat(300);
      await filter.click();
      await filter.pressSequentially("route", { delay: 95 }); // narrows to src/routes/*
      await beat(1300);
      await filter.fill("");
      await beat(600);

      // scroll down through the long tree, then back up
      await nav.hover();
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 260);
        await beat(360);
      }
      await beat(350);
      for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, -320);
        await beat(320);
      }
      const zoomOut = since();

      // jump to a file and mark it viewed
      const file = nav.getByRole("button", { name: /users\.ts/ }).first();
      await glideTo(file);
      await beat(200);
      await file.click();
      await beat(500);
      await page.keyboard.press("v"); // mark viewed
      await beat(1000);
      captions[0].toSec = since();
      return { zooms: [{ rect: { x: rect.x, y: rect.y, width: rect.width, height: Math.min(rect.height, 520) }, inSec: zoomIn, outSec: zoomOut, scale: 1.7 }], captions };
    },
  },
];
