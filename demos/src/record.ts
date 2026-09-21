// records REAL motion footage of diffle being used: Playwright drives the live app with a
// visible synthetic cursor and paced typing, one take per driver. each take gets its own fresh
// backend + fixture (clean review state) and emits footage/<id>.webm + footage/<id>.json (zoom
// windows + captions). node/tsx only (playwright + bun + windows hangs).
import { chromium, type Browser, type Page, type Locator } from "playwright";
import { mkdirSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFixture, startBackend, stop, cleanup } from "./lib/backend";
import { FIXTURE } from "./lib/fixture";
import { WIDTH, HEIGHT, FPS } from "./scenes";
import { DRIVERS, type Driver } from "./drivers";
import type { TakeMeta } from "./meta";

const HERE = dirname(fileURLToPath(import.meta.url));
const FOOTAGE = join(HERE, "..", "public", "footage");

// a soft brand-coloured cursor + click pulse, injected so the recording shows pointer motion
// (headless chromium renders no OS cursor). it tracks the mouse events Playwright dispatches.
const CURSOR = `(() => {
  const d = document.createElement('div');
  d.id = '__demo_cursor';
  d.style.cssText = 'position:fixed;z-index:2147483647;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;pointer-events:none;background:rgba(111,130,240,.28);border:2px solid #6f82f0;box-shadow:0 0 14px rgba(111,130,240,.6);left:-100px;top:-100px;transition:transform .09s ease';
  const add = () => { if (document.body && !document.getElementById('__demo_cursor')) document.body.appendChild(d); };
  addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { d.style.transform = 'scale(.55)'; }, true);
  addEventListener('mouseup', () => { d.style.transform = 'scale(1)'; }, true);
  if (document.readyState !== 'loading') add(); else addEventListener('DOMContentLoaded', add);
})();`;

async function recordTake(browser: Browser, driver: Driver): Promise<void> {
  const fixture = makeFixture(FIXTURE);
  const { server, url } = startBackend(fixture);
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    colorScheme: "dark",
    recordVideo: { dir: FOOTAGE, size: { width: WIDTH, height: HEIGHT } },
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const t0 = Date.now();
  const since = () => (Date.now() - t0) / 1000;
  const beat = (ms = 500) => page.waitForTimeout(ms);
  const glideTo = async (_p: Page, locator: Locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error("element has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 26 });
  };

  try {
    const reviewUrl = await url;
    await page.goto(reviewUrl);
    await page
      .getByRole("dialog", { name: /What's new/ })
      .waitFor({ state: "visible", timeout: 1500 })
      .then(() => page.keyboard.press("Escape"))
      .catch(() => {});
    await beat(900);

    const { zooms, captions } = await driver.run({ page, since, glideTo: (l) => glideTo(page, l), beat });
    const durationSec = since() + 0.4;

    const video = page.video();
    await context.close();
    if (video) renameSync(await video.path(), join(FOOTAGE, `${driver.id}.webm`));
    const meta: TakeMeta = { id: driver.id, durationSec, zooms, captions: captions.map((c) => ({ ...c, toSec: Math.min(c.toSec, durationSec) })) };
    writeFileSync(join(FOOTAGE, `${driver.id}.json`), JSON.stringify(meta, null, 2));
    console.log(`recorded ${driver.id} (${durationSec.toFixed(1)}s, ${zooms.length} zoom${zooms.length === 1 ? "" : "s"})`);
  } finally {
    await stop(server);
    cleanup(fixture);
  }
}

async function run(): Promise<void> {
  rmSync(FOOTAGE, { recursive: true, force: true });
  mkdirSync(FOOTAGE, { recursive: true });
  const only = process.argv[2]; // optional: record a single take by id
  const takes = only ? DRIVERS.filter((d) => d.id === only) : DRIVERS;
  if (takes.length === 0) throw new Error(`no take matches "${only}"`);
  const browser = await chromium.launch();
  try {
    for (const driver of takes) await recordTake(browser, driver);
  } finally {
    await browser.close();
  }
  console.log(`\ndone — ${takes.length} take(s) in public/footage/`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
