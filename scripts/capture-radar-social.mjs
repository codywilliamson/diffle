// Records the production ?radar-demo=1 flow as a short captioned 16:9 social clip.
import { chromium } from "playwright";
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, "out", "radar-social");
const repo = join(work, "repo");
const data = join(work, "loupe-data");
const rawVideo = join(work, "video");
const shots = join(root, "docs", "screenshots");
const port = 43128;
const size = { width: 1920, height: 1080 };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (command, args) => spawnSync(command, args, { cwd: root, encoding: "utf8" });
const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };

function seedRepo() {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(repo, { recursive: true });
  const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  write(join(repo, "package.json"), '{"name":"loupe-radar-demo","private":true,"type":"module"}\n');
  write(join(repo, "src/server/sessionHandlers.ts"), `export async function stopSession(id: string) {
  const session = readSession(id);
  if (!session) return false;
  await removeSession(id);
  return true;
}\n`);
  write(join(repo, "src/core/reviewRecords.ts"), `export function writeRecord(file: string, record: object) {
  writeFileSync(file, JSON.stringify(record));
}\n`);
  write(join(repo, "src/client/reviewSync.js"), `export function applyReview(previous, next) {
  setRecord(next);
}\n`);
  write(join(repo, "src/routes/billing.ts"), `export function canRefund(user: User) {
  return user.role === "admin";
}\n`);
  write(join(repo, "README.md"), "# Review service\n\nLocal review infrastructure.\n");
  git("init", "-q", "-b", "main"); git("config", "user.name", "Loupe Demo"); git("config", "user.email", "demo@loupe.local");
  git("add", "-A"); git("commit", "-q", "-m", "chore: establish radar demo baseline");
  write(join(repo, "src/server/sessionHandlers.ts"), `export async function stopSession(id: string) {
  const session = readSession(id);
  if (!session) throw new Error("session missing");
  const child = children.get(id);
  child?.kill();
  await removeSession(id);
  return true;
}\n`);
  write(join(repo, "src/core/reviewRecords.ts"), `export function writeRecord(file: string, record: object) {
  const temp = file + ".tmp";
  writeFileSync(temp, JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
  renameSync(temp, file);
}\n`);
  write(join(repo, "src/client/reviewSync.js"), `export function applyReview(previous, next, generation) {
  if (generation !== generationRef.current) return;
  setRecord({ ...previous, ...next });
}\n`);
  write(join(repo, "src/routes/billing.ts"), `export function canRefund(user: User, order: Order) {
  return user.role === "admin" || (user.id === order.ownerId && order.status === "paid");
}\n`);
  write(join(repo, "src/config/providerKeys.ts"), `export const fallback = "sk-or-v1-9f2c0b4e1234567890abcdefghijklmnop";\n`);
  write(join(repo, "tests/sessionHandlers.test.ts"), `import { test, expect } from "bun:test";
test("missing sessions throw", () => {
  expect(() => { throw new Error("session missing"); }).toThrow("session missing");
});\n`);
  write(join(repo, "README.md"), "# Review service\n\nLocal review infrastructure with durable rereview records.\n");
}

async function waitForLoupe() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/diff`)).ok) return; } catch {}
    await wait(100);
  }
  throw new Error("Loupe did not start");
}

async function installCaption(page) {
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = `
      #radar-social-caption{position:fixed;z-index:9999;left:50%;bottom:28px;translate:-50% 12px;
        max-width:min(980px,82vw);padding:13px 20px;border:1px solid var(--border);border-radius:8px;
        background:color-mix(in srgb,var(--surface) 94%,transparent);color:var(--text);
        box-shadow:0 14px 34px rgba(23,25,24,.28);font:600 20px/1.35 var(--font);letter-spacing:-.01em;
        text-align:center;opacity:0;transition:opacity .22s ease-out,translate .22s ease-out;pointer-events:none}
      #radar-social-caption.show{opacity:1;translate:-50% 0}
      #radar-social-caption strong{color:var(--accent)}
      @media(prefers-reduced-motion:reduce){#radar-social-caption{transition:none}}
    `;
    const caption = document.createElement("div");
    caption.id = "radar-social-caption";
    caption.setAttribute("aria-hidden", "true");
    document.head.appendChild(style);
    document.body.appendChild(caption);
  });
}

async function caption(page, html, duration = 1500) {
  await page.evaluate((value) => {
    const node = document.getElementById("radar-social-caption");
    node.classList.remove("show");
    node.innerHTML = value;
    requestAnimationFrame(() => node.classList.add("show"));
  }, html);
  await wait(duration);
}

async function record(page) {
  const total = (await page.locator(".radar-total").innerText()).trim();
  await caption(page, `Jev analyzed the agent diff into <strong>${total}</strong>. Where do you start?`, 1800);
  const attention = page.locator('.radar-unit[aria-label^="semantic attention"]');
  const target = await attention.count() ? attention.first() : page.locator('.radar-unit[aria-label^="boundary review"]').first();
  await target.click();
  await page.locator(".radar-proof").waitFor();
  await caption(page, "Deterministic checks set the floor. <strong>Jev ranks the semantic uncertainty.</strong>", 1900);
  await page.locator(".radar-proof .radar-evidence").click();
  await page.locator(".evidence-drawer").waitFor();
  await page.screenshot({ path: join(shots, "radar-social.png") });
  await caption(page, "Live Jev probabilities stay inspectable beside local evidence and provenance.", 2100);
  await page.getByRole("button", { name: /Reveal exact packet/ }).click();
  await page.locator(".evidence-packet").waitFor();
  await caption(page, "See the <strong>exact redacted request</strong> sent to OpenRouter's Decisions API.", 2100);
  await page.getByRole("button", { name: "Close evidence" }).click();
  await page.locator(".evidence-drawer").waitFor({ state: "hidden" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".radar-badge", { hasText: "cached" }).waitFor({ timeout: 30_000 });
  await installCaption(page);
  await caption(page, "Reloaded instantly from the local cache. <strong>Raw packet code is never cached.</strong>", 1800);
  await page.locator('.radar-unit[aria-label^="local blocker"]').first().click();
  await page.locator(".radar-proof").waitFor();
  await page.locator(".radar-proof .radar-evidence").click();
  await page.locator(".evidence-drawer").waitFor();
  await caption(page, "Secret-shaped code is redacted and <strong>never leaves your machine.</strong>", 2100);
  await page.getByRole("button", { name: "Close evidence" }).click();
  await page.locator(".evidence-drawer").waitFor({ state: "hidden" });
  await page.locator('.top-bar button[aria-label^="Theme:"]').click();
  await caption(page, "<strong>loupe radar</strong> · local-first review for agent-generated code", 2600);
}

function convert(webm) {
  const mp4 = join(shots, "radar-social.mp4");
  const result = run("ffmpeg", ["-y", "-i", webm, "-an", "-c:v", "libx264", "-profile:v", "high",
    "-pix_fmt", "yuv420p", "-b:v", "6000k", "-maxrate", "8000k", "-bufsize", "12000k", "-movflags", "+faststart", mp4]);
  if (result.status !== 0) throw new Error(`FFmpeg failed: ${result.stderr}`);
  return mp4;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required for the live Radar capture");
  seedRepo();
  mkdirSync(rawVideo, { recursive: true });
  mkdirSync(shots, { recursive: true });
  const server = spawn("bun", [join(root, "src", "index.ts"), "--no-open", "--port", String(port)],
    { cwd: repo, env: { ...process.env, LOUPE_DATA_DIR: data, LOUPE_RADAR: "1", LOUPE_RADAR_PROVIDER: "openrouter" }, stdio: "ignore" });
  let browser;
  try {
    await waitForLoupe();
    const reviewId = readdirSync(join(data, "reviews"))[0];
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: size, colorScheme: "dark", recordVideo: { dir: rawVideo, size } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto(`http://localhost:${port}/?review=${reviewId}`, { waitUntil: "domcontentloaded" });
    await page.locator(".radar-map").waitFor({ timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector(".radar-live")?.textContent?.includes("Radar ready"), null, { timeout: 60_000 });
    const gotIt = page.getByRole("button", { name: "Got it" });
    if (await gotIt.isVisible()) await gotIt.click();
    await installCaption(page);
    await record(page);
    const video = page.video();
    await context.close();
    const webm = join(shots, "radar-social.webm");
    copyFileSync(await video.path(), webm);
    const mp4 = convert(webm);
    if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
    console.log(`Generated ${mp4}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

await main();
