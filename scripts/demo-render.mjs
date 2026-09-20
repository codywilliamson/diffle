// Phase 2: composite the clean recording + timeline into the finished demo with Remotion, then
// derive the WebM and the poster still and publish all three to docs/screenshots. Run after
// demo-record.mjs (which produces remotion/public/radar.mp4 + out/product-demo/timeline.json).
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, renderStill } from "@remotion/renderer";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, "out", "product-demo");
const shots = join(root, "docs", "screenshots");
const outMp4 = join(work, "radar-social.mp4");
const outWebm = join(work, "radar-social.webm");
const outPng = join(work, "radar-social.png");
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" });
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} };

function copyWithRetry(src, dst, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try { copyFileSync(src, dst); return; } catch (e) { if (i === attempts) throw e; sleep(400); }
  }
}

async function main() {
  const timeline = JSON.parse(readFileSync(join(work, "timeline.json"), "utf8"));
  const inputProps = { timeline };
  mkdirSync(work, { recursive: true });
  mkdirSync(shots, { recursive: true });

  console.log("Bundling Remotion…");
  const serveUrl = await bundle({ entryPoint: join(root, "remotion", "index.ts"), publicDir: join(root, "remotion", "public") });
  const composition = await selectComposition({ serveUrl, id: "RadarDemo", inputProps });
  const gl = process.env.DEMO_GL ?? "angle";

  console.log(`Rendering ${composition.durationInFrames} frames…`);
  let last = 0;
  await renderMedia({
    composition, serveUrl, inputProps, codec: "h264", outputLocation: outMp4,
    pixelFormat: "yuv420p", crf: 20, x264Preset: "medium",
    chromiumOptions: { gl }, concurrency: null,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct >= last + 10) { last = pct; process.stdout.write(` ${pct}%`); }
    },
  });
  process.stdout.write("\n");

  // poster: a frame where the closing caption is fully shown, not mid fade-out.
  const posterFrame = Math.max(0, composition.durationInFrames - 24);
  await renderStill({ composition, serveUrl, inputProps, output: outPng, frame: posterFrame, chromiumOptions: { gl } });

  // Remotion emits full-range yuvj420p; remap to standard limited-range yuv420p for compatibility.
  const range = ["-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-color_range", "tv"];
  const finalMp4 = join(work, "radar-social.final.mp4");
  const mp4 = run("ffmpeg", ["-y", "-i", outMp4, "-an", ...range, "-c:v", "libx264", "-preset", "medium",
    "-crf", "19", "-movflags", "+faststart", finalMp4]);
  if (mp4.status !== 0) throw new Error(`MP4 encode failed: ${mp4.stderr}`);
  const webm = run("ffmpeg", ["-y", "-i", outMp4, "-an", ...range, "-c:v", "libvpx-vp9",
    "-b:v", "0", "-crf", "33", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", outWebm]);
  if (webm.status !== 0) throw new Error(`WebM encode failed: ${webm.stderr}`);
  copyWithRetry(finalMp4, join(shots, "radar-social.mp4"));
  copyWithRetry(outWebm, join(shots, "radar-social.webm"));
  copyWithRetry(outPng, join(shots, "radar-social.png"));

  const probe = run("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", join(shots, "radar-social.mp4")]);
  const data = JSON.parse(probe.stdout);
  const v = data.streams.find((s) => s.codec_type === "video");
  console.log("SPECS:", JSON.stringify({ w: v.width, h: v.height, codec: v.codec_name, pix: v.pix_fmt,
    fps: v.r_frame_rate, seconds: +(+data.format.duration).toFixed(2), sizeMB: +(+data.format.size / 1e6).toFixed(2) }));
  console.log("DELIVERED:", join(shots, "radar-social.mp4"), join(shots, "radar-social.webm"), join(shots, "radar-social.png"));
}

await main();
