// Phase 1: record the live Radar flow as a CLEAN screencast (no overlays) plus a motion timeline.
// A black clapperboard marks the origin; the flow drives real OpenRouter Jev interactions and logs
// cursor/camera/caption events for Remotion. Outputs remotion/public/radar.mp4 + timeline/meta json.
import { chromium } from "playwright";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { seedRepo } from "./product-demo/seed-repo.mjs";
import { Timeline } from "./product-demo/timeline.mjs";
import { radarFlow } from "./product-demo/radar-flow.mjs";
import { findOrigin, trimForRemotion } from "./product-demo/convert.mjs";
import { wait } from "./product-demo/actions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, "out", "product-demo");
const repo = join(work, "repo");
const data = join(work, "loupe-data");
const rawVideo = join(work, "video");
const publicMp4 = join(root, "remotion", "public", "radar.mp4");
const port = 43128;
const size = { width: 1920, height: 1080 };
const EXPECTED = "openrouter · typesafe/jev-1.13";

async function waitForLoupe() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/diff`)).ok) return; } catch {}
    await wait(100);
  }
  throw new Error("Loupe did not start");
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required for the live Radar capture");
  seedRepo({ work, repo });
  mkdirSync(rawVideo, { recursive: true });
  mkdirSync(dirname(publicMp4), { recursive: true });
  const server = spawn("bun", [join(root, "src", "index.ts"), "--no-open", "--port", String(port)],
    { cwd: repo, env: { ...process.env, LOUPE_DATA_DIR: data, LOUPE_RADAR: "1", LOUPE_RADAR_PROVIDER: "openrouter" }, stdio: "ignore" });
  let browser;
  try {
    await waitForLoupe();
    const reviewId = readdirSync(join(data, "reviews"))[0];
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: size, colorScheme: "dark", deviceScaleFactor: 1, recordVideo: { dir: rawVideo, size } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

    await page.goto(`http://localhost:${port}/?review=${reviewId}`, { waitUntil: "domcontentloaded" });
    await page.locator(".radar-map").waitFor({ timeout: 20000 });
    await page.waitForFunction(() => document.querySelector(".radar-live")?.textContent?.includes("Radar ready"), null, { timeout: 90000 });
    const live = await page.evaluate(() => ({
      provider: document.querySelector(".radar-provider")?.textContent?.trim(),
      total: document.querySelector(".radar-total")?.textContent?.trim(),
      counts: [...document.querySelectorAll(".radar-count")].map((c) => c.textContent.trim()),
    }));
    if (!live.provider?.startsWith(EXPECTED)) throw new Error(`Unexpected provider/model: ${live.provider}`);
    const got = page.getByRole("button", { name: "Got it" });
    if (await got.isVisible().catch(() => false)) await got.click();

    // clapperboard: a pure-black full-screen frame marks the timeline origin.
    await page.evaluate(() => {
      const d = document.createElement("div");
      d.id = "clap"; d.style.cssText = "position:fixed;inset:0;background:#000;z-index:2147483647";
      document.body.appendChild(d);
    });
    await wait(400);
    const tl = new Timeline({ fps: 30, ...size });
    await page.evaluate(() => document.getElementById("clap")?.remove());
    tl.start();
    tl.cursorKey(0, 320, 940);
    tl.cameraKey(0, { scale: 1, cx: size.width / 2, cy: size.height / 2 });
    const ctx = { page, tl, cur: { x: 320, y: 940 }, cam: { scale: 1, cx: size.width / 2, cy: size.height / 2 } };

    await radarFlow(ctx);
    tl.finish(tl.now());
    tl.write(join(work, "timeline.json"));

    const video = page.video();
    await context.close();
    const raw = await video.path();
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);

    const origin = findOrigin(raw);
    const meta = trimForRemotion(raw, origin, publicMp4);
    writeFileSync(join(work, "meta.json"), JSON.stringify({ ...meta, ...live, originSec: +origin.toFixed(3) }, null, 2));
    console.log("LIVE:", JSON.stringify(live));
    console.log("META:", JSON.stringify(meta), "origin=", origin.toFixed(3));
    console.log("TIMELINE:", join(work, "timeline.json"));
    console.log("CLEAN MP4:", publicMp4);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

await main();
