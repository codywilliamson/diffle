// the launch takes: keyboard review, suggested changes, a second review round, the scorecard and
// review order, code navigation, and cross-file search. all run on the showcase fixture.
import type { Page } from "playwright";
import type { Caption, Rect, ZoomSegment } from "./meta";
import type { Driver, DriverCtx } from "./drivers";
import { SHOWCASE, SHOWCASE_CHURN, SHOWCASE_IP_LINE, SHOWCASE_LIMITER_LINE, SHOWCASE_429_LINE, SHOWCASE_SEARCH } from "./lib/showcase";
import { cursorTo, pickFile, wordBox } from "./lib/dom";
import { SERVER_FILE, SUGGEST_NOTE, SUGGESTED_LINE, ROUND_ONE_COMMENT, changedChip, editor, agentRoundTwo } from "./lib/flows";

const TYPE_DELAY = 26;
const LIMITER_COLUMN = "const allow = ".length; // createLimiter on server.ts:6
const KEY_PACE = 110;
const KEYBOARD_COMMENT = "trust only the proxy header";
const ROUND_SUMMARY = "One fix, then ship it.";

const base = { fixture: SHOWCASE, fixtureOptions: { churn: SHOWCASE_CHURN } };

const section = (page: Page, path: string) => page.locator(`section.file-section[data-file-path="${path}"], section.file-section:has([data-file-path="${path}"])`).first();
const boxOf = async (page: Page, selector: ReturnType<Page["locator"]>): Promise<Rect> => (await selector.boundingBox()) as Rect;

// captions open with `at` and are closed by `close`, so each driver reads top to bottom.
function captionTrack(ctx: DriverCtx) {
  const captions: Caption[] = [];
  return {
    captions,
    open: (text: string, at = ctx.since()) => captions.push({ text, fromSec: at, toSec: 99 }),
    close: () => {
      const last = captions[captions.length - 1];
      if (last) last.toSec = ctx.since();
    },
  };
}

async function press(ctx: DriverCtx, keys: string[], pace = KEY_PACE): Promise<void> {
  for (const key of keys) {
    await ctx.page.keyboard.press(key);
    await ctx.beat(pace);
  }
}

async function glideToPoint(page: Page, r: Rect): Promise<void> {
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 26 });
}

async function openServerInTree(ctx: DriverCtx): Promise<void> {
  const file = ctx.page.getByRole("navigation", { name: "Changed files" }).getByRole("button", { name: /server\.ts/ }).first();
  await ctx.glideTo(file);
  await ctx.beat(200);
  await file.click();
  await ctx.beat(500);
}

async function commentOnLine(ctx: DriverCtx, line: number, text: string): Promise<Rect> {
  const bubble = section(ctx.page, SERVER_FILE).getByRole("button", { name: new RegExp(`Comment on line ${line}\\b`) }).first();
  await ctx.glideTo(bubble);
  await ctx.beat(300);
  await bubble.click();
  await editor(ctx.page).waitFor();
  const rect = await boxOf(ctx.page, editor(ctx.page));
  await editor(ctx.page).pressSequentially(text, { delay: TYPE_DELAY });
  return rect;
}

const keyboard: Driver = {
  id: "keyboard",
  ...base,
  run: async (ctx) => {
    const { page, since, beat } = ctx;
    const track = captionTrack(ctx);
    track.open("Review without touching the mouse", 0.4);
    await pickFile(page, "server", 200);
    await beat(300);
    const zoomIn = since();
    const rect = await boxOf(page, section(page, SERVER_FILE));
    await cursorTo(page, SERVER_FILE, SHOWCASE_LIMITER_LINE, 110);
    await press(ctx, ["]", "["], 650);
    await cursorTo(page, SERVER_FILE, SHOWCASE_IP_LINE, 110);
    await beat(300);
    await page.keyboard.press("c");
    await editor(page).waitFor();
    await beat(250);
    await editor(page).pressSequentially(KEYBOARD_COMMENT, { delay: TYPE_DELAY });
    await beat(350);
    await page.keyboard.press("Control+Enter");
    await page.getByText(KEYBOARD_COMMENT).first().waitFor();
    await beat(700);
    track.close();
    track.open("R resolves it");
    await page.keyboard.press("R");
    await beat(1300);
    track.close();
    const zooms: ZoomSegment[] = [{ rect: { ...rect, height: Math.min(rect.height, 560) }, inSec: zoomIn, outSec: since(), scale: 1.3 }];
    return { zooms, captions: track.captions };
  },
};

const suggest: Driver = {
  id: "suggest",
  ...base,
  run: async (ctx) => {
    const { page, since, glideTo, beat } = ctx;
    const track = captionTrack(ctx);
    track.open("Suggest the fix, not just the problem", 0.4);
    await openServerInTree(ctx);
    const zoomIn = since();
    const rect = await commentOnLine(ctx, SHOWCASE_429_LINE, SUGGEST_NOTE);
    const button = page.getByRole("button", { name: "Suggest change" });
    await glideTo(button);
    await beat(250);
    await button.click();
    await beat(500);
    await page.keyboard.type(SUGGESTED_LINE, { delay: 16 });
    await beat(400);
    const save = page.getByRole("button", { name: "Save" });
    await glideTo(save);
    await save.click();
    await page.locator(".comment-card .suggestion").first().waitFor();
    await beat(1700);
    track.close();
    const card = await boxOf(page, page.locator(".comment-card").first());
    const zone: Rect = { x: rect.x, y: rect.y - 40, width: rect.width, height: Math.max(card.height, rect.height) + 60 };
    return { zooms: [{ rect: zone, inSec: zoomIn, outSec: since(), scale: 1.35 }], captions: track.captions };
  },
};

const rereview: Driver = {
  id: "rereview",
  ...base,
  run: async (ctx) => {
    const { page, since, glideTo, beat, fixture } = ctx;
    const track = captionTrack(ctx);
    track.open("Send feedback to your agent", 0.4);
    await openServerInTree(ctx);
    await commentOnLine(ctx, SHOWCASE_429_LINE, ROUND_ONE_COMMENT);
    await page.keyboard.press("Control+Enter");
    await beat(400);
    const menu = page.getByRole("button", { name: /Review menu/ });
    await glideTo(menu);
    await menu.click();
    const summary = page.getByRole("textbox", { name: "Reviewer summary" });
    await summary.waitFor();
    await summary.pressSequentially(ROUND_SUMMARY, { delay: TYPE_DELAY });
    const send = page.getByRole("button", { name: "Return Feedback" });
    await glideTo(send);
    await beat(200);
    await send.click();
    await beat(700);
    await page.keyboard.press("Escape");
    track.close();

    track.open("Round two shows only what changed");
    await agentRoundTwo(page, fixture);
    await beat(600);
    const toggle = page.getByRole("button", { name: "Show only changes since last review" }).first();
    await toggle.scrollIntoViewIfNeeded();
    await glideTo(changedChip(page));
    await beat(400);
    await glideTo(toggle);
    await toggle.click();
    await page.getByRole("button", { name: "Showing changes since review" }).first().waitFor();
    const zoomIn = since();
    const rect = await boxOf(page, section(page, SERVER_FILE));
    await beat(2200);
    track.close();
    return { zooms: [{ rect: { ...rect, x: rect.x + rect.width * 0.35, height: Math.min(rect.height, 420) }, inSec: zoomIn, outSec: since(), scale: 1.3 }], captions: track.captions };
  },
};

const scorecard: Driver = {
  id: "scorecard",
  ...base,
  run: async (ctx) => {
    const { page, since, glideTo, beat } = ctx;
    const track = captionTrack(ctx);
    track.open("A scorecard says where to look first", 0.4);
    await beat(300);
    await press(ctx, ["g", "c"], 120);
    const dialog = page.getByRole("dialog").first();
    await dialog.waitFor();
    await beat(900);
    const tests = dialog.getByText("Tests", { exact: true });
    await glideTo(tests);
    await tests.click();
    await beat(1500);
    await page.keyboard.press("Escape");
    track.close();
    track.open("Review order: dependencies first, noise last");
    await beat(250);
    await page.keyboard.press("m");
    const nav = page.getByRole("navigation", { name: "Changed files" });
    await page.getByText("Generated & lockfiles").waitFor();
    const zoomIn = since();
    const rect = await boxOf(page, nav);
    await beat(2300);
    track.close();
    return { zooms: [{ rect: { ...rect, height: Math.min(rect.height, 560) }, inSec: zoomIn, outSec: since(), scale: 1.6 }], captions: track.captions };
  },
};

// the first language-server request starts typescript-language-server; pay that before recording.
async function warmLanguageServer(reviewUrl: string): Promise<void> {
  const origin = new URL(reviewUrl).origin;
  const at = { path: SERVER_FILE, side: "new", line: SHOWCASE_LIMITER_LINE, character: LIMITER_COLUMN };
  for (const route of ["hover", "references"]) {
    await fetch(`${origin}/api/lsp/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(at) }).catch(() => {});
  }
}

const codenav: Driver = {
  id: "codenav",
  ...base,
  warmup: warmLanguageServer,
  run: async (ctx) => {
    const { page, since, beat } = ctx;
    const track = captionTrack(ctx);
    track.open("Hover any symbol for its docs", 0.4);
    await pickFile(page, "server", 200);
    await cursorTo(page, SERVER_FILE, SHOWCASE_LIMITER_LINE, 90);
    await glideToPoint(page, await wordBox(page, SERVER_FILE, SHOWCASE_LIMITER_LINE, "createLimiter"));
    const card = page.locator("[data-hover-card]").filter({ hasText: "token-bucket" });
    await card.waitFor({ timeout: 20_000 });
    const hoverIn = since();
    const hoverRect = await boxOf(page, card);
    await beat(1900);
    const hoverOut = since();
    track.close();

    track.open("gd jumps to the definition");
    await press(ctx, ["g", "d"], 100);
    await page.locator(`[data-file-path="src/rateLimiter.ts"] [data-cursor]`).waitFor({ timeout: 15_000 });
    await beat(1900);
    track.close();

    track.open("gA lists every reference");
    await press(ctx, ["g", "A"], 100);
    const panel = page.locator("[data-references-panel]");
    await panel.locator("[data-reference-group]").nth(2).waitFor({ timeout: 15_000 });
    await page.mouse.move(1270, 790, { steps: 12 });
    await beat(2300);
    track.close();
    const zooms: ZoomSegment[] = [{ rect: { ...hoverRect, y: hoverRect.y - 40, height: hoverRect.height + 40 }, inSec: hoverIn, outSec: hoverOut, scale: 1.35 }];
    return { zooms, captions: track.captions };
  },
};

const search: Driver = {
  id: "search",
  ...base,
  run: async (ctx) => {
    const { page, since, beat } = ctx;
    const track = captionTrack(ctx);
    track.open("g/ searches every changed file", 0.4);
    await press(ctx, ["j"], 400);
    await press(ctx, ["g", "/"], 150);
    const panel = page.locator("[data-search-all]");
    await panel.waitFor();
    await page.keyboard.type(SHOWCASE_SEARCH, { delay: 90 });
    await page.locator("[data-search-all-count]").filter({ hasText: /match/ }).waitFor();
    const zoomIn = since();
    const rect = await boxOf(page, panel);
    await beat(900);
    await press(ctx, ["ArrowDown", "ArrowDown"], 380);
    const zoomOut = since();
    await page.keyboard.press("Enter");
    await beat(1300);
    track.close();
    track.open("Ctrl+o jumps back");
    await page.keyboard.press("Escape");
    await beat(300);
    await page.keyboard.press("Control+o");
    await beat(1500);
    track.close();
    return { zooms: [{ rect: { ...rect, width: Math.min(rect.width, 760) }, inSec: zoomIn, outSec: zoomOut, scale: 1.45 }], captions: track.captions };
  },
};

export const LAUNCH_DRIVERS: Driver[] = [keyboard, suggest, rereview, scorecard, codenav, search];
