// The Radar product story as real interactions plus a logged motion timeline. Every click/select/
// reload is genuine live Jev; the cursor, camera and captions are recorded as data and composited
// later. Camera pull-backs before drawer open/close keep the clicked control inside the output frame.
import { rect, moveTo, moveToXY, hoverFor, click, focus, reset, caption, wait } from "./actions.mjs";

const MAP = ".radar-map";
const ATTN = '.radar-unit[aria-label^="semantic attention"]';
const BOUNDARY = '.radar-unit[aria-label^="boundary review"]';
const BLOCKER = '.radar-unit[aria-label^="local blocker"]';
const PROOF = ".radar-proof";
const SUMMARY = ".radar-proof-summary";
const PROVENANCE = ".radar-provenance";
const EVIDENCE_BTN = ".radar-proof .radar-evidence";
const DRAWER = ".evidence-drawer";
const DRAWER_OPEN = ".evidence-drawer.is-open";
const REVEAL = ".evidence-drawer .btn-toggle";
const PACKET = ".evidence-packet";
const CLOSE = '.evidence-drawer [aria-label="Close evidence"]';
const BADGE = ".radar-badge";

async function dismissWhatsNew(page) {
  const got = page.getByRole("button", { name: "Got it" });
  if (await got.isVisible().catch(() => false)) await got.click();
}

// let Loupe's own scroll settle at 1:1, then push the camera into the selected proof row.
async function revealProof(ctx, { scale = 1.4, biasY = -80 } = {}) {
  await reset(ctx, { dur: 380 });
  await ctx.page.waitForSelector(PROOF, { state: "visible", timeout: 8000 });
  await wait(520);
  await focus(ctx, PROOF, { scale, dur: 500, biasY });
}

async function openDrawer(ctx, { scale = 1.3 } = {}) {
  await reset(ctx, { dur: 360 });
  if (!(await ctx.page.locator(DRAWER).count())) await click(ctx, EVIDENCE_BTN);
  await ctx.page.waitForSelector(DRAWER_OPEN, { timeout: 6000 });
  await wait(220);
  await focus(ctx, DRAWER, { scale, dur: 460 });
}

async function closeDrawer(ctx) {
  await reset(ctx, { dur: 380 });
  await click(ctx, CLOSE);
  await ctx.page.waitForSelector(DRAWER, { state: "detached", timeout: 6000 });
}

export async function radarFlow(ctx) {
  const { page } = ctx;

  // 1 — establishing view
  caption(ctx, "An agent changed 6 files. Where should review start?");
  await wait(900);
  await moveTo(ctx, MAP, 560);

  // 2 — review map
  await focus(ctx, MAP, { scale: 1.32, dur: 520 });
  caption(ctx, "Deterministic evidence sets the floor. Jev ranks the uncertainty.");
  await hoverFor(ctx, BOUNDARY, 140);
  await hoverFor(ctx, ATTN, 200);
  await click(ctx, ATTN);

  // 3 — inline proof
  await revealProof(ctx);
  caption(ctx, "Review jumps directly to the behavior most likely to matter.");
  await moveTo(ctx, SUMMARY, 360);
  await wait(240);
  await moveTo(ctx, PROVENANCE, 340);
  await wait(300);

  // 4 — evidence drawer
  await openDrawer(ctx);
  caption(ctx, "Every rank stays inspectable.", "left");
  await moveTo(ctx, ".evidence-chip-line", 380);
  await wait(240);
  await moveTo(ctx, ".evidence-facts", 380);
  await wait(240);
  await click(ctx, REVEAL);
  await page.waitForFunction(() => {
    const el = document.querySelector(".evidence-packet");
    return el && !el.textContent.includes("Loading packet");
  }, null, { timeout: 8000 });
  await page.evaluate(() => document.querySelector(".evidence-packet")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  await wait(320);
  await focus(ctx, PACKET, { scale: 1.32, dur: 460 });
  caption(ctx, "See exactly what left the machine.", "left");
  await wait(1100);

  // 5 — cache behaviour
  await closeDrawer(ctx);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(MAP, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".radar-badge")?.textContent?.includes("cached"), null, { timeout: 30000 });
  await dismissWhatsNew(page);
  caption(ctx, "Reloads instantly from the local cache.");
  await wait(500);
  await moveTo(ctx, BADGE, 460);
  await focus(ctx, BADGE, { scale: 1.85, dur: 440 });
  await wait(850);

  // 6 — local blocker
  await reset(ctx, { dur: 420 });
  await click(ctx, BLOCKER);
  if (await page.locator(DRAWER).count()) await closeDrawer(ctx);
  await revealProof(ctx, { scale: 1.5, biasY: -60 });
  caption(ctx, "Secret-shaped code is blocked locally and never transmitted.");
  await moveTo(ctx, ".radar-blocked", 420);
  await wait(520);
  await openDrawer(ctx);
  await wait(1200);

  // 7 — closing frame
  await closeDrawer(ctx);
  await moveTo(ctx, ".radar-live", 480);
  caption(ctx, "Loupe Radar — local-first review intelligence for agent-generated code");
  await wait(1500);
}
