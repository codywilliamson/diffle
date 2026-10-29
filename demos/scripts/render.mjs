// renders every take as a standalone short (out/<id>.mp4) plus a poster frame (out/<id>.jpg), the
// stitched long reel (out/walkthrough.mp4), and a punchy README gif from the comment take
// (out/walkthrough.gif). `npm run render -- <id>` renders just that short and its poster.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const demos = join(here, "..");
const footage = join(demos, "public", "footage");
const only = process.argv[2];
const ids = readdirSync(footage)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""))
  .filter((id) => !only || id === only);

// remotion defaults to half the cores, each a headless chrome decoding 2x footage — enough to
// starve the machine of memory. one tab is slower but leaves room for everything else.
const RENDER_CONCURRENCY = 1;
// offthreadvideo's frame cache otherwise grows with free memory; the long reel starved the machine
// even at concurrency 1 until this was capped.
const VIDEO_CACHE_BYTES = 400_000_000;
// the poster is the moment the take's first zoom has settled, else 60% through
const ZOOM_SETTLE_SEC = 0.9;
const POSTER_FALLBACK = 0.6;

const remotion = (args) =>
  execFileSync("npx", ["remotion", ...args, "--concurrency", String(RENDER_CONCURRENCY), "--offthreadvideo-cache-size-in-bytes", String(VIDEO_CACHE_BYTES)], { cwd: demos, stdio: "inherit", shell: true });

function posterSec(id) {
  const meta = JSON.parse(readFileSync(join(footage, `${id}.json`), "utf8"));
  const zoom = meta.zooms[0];
  return zoom ? Math.min(zoom.inSec + ZOOM_SETTLE_SEC, meta.durationSec - 0.2) : meta.durationSec * POSTER_FALLBACK;
}

// remotion bundles its own ffmpeg, so posters need nothing extra on PATH
const poster = (id) =>
  execFileSync("npx", ["remotion", "ffmpeg", "-loglevel", "error", "-y", "-ss", posterSec(id).toFixed(2), "-i", `out/${id}.mp4`, "-frames:v", "1", "-q:v", "3", `out/${id}.jpg`], { cwd: demos, stdio: "inherit", shell: true });

for (const id of ids) {
  remotion(["render", "src/index.ts", `take-${id}`, `out/${id}.mp4`, "--crf", "23", "--log=error"]);
  poster(id);
}
if (!only) {
  remotion(["render", "src/index.ts", "LongReel", "out/walkthrough.mp4", "--crf", "26", "--log=error"]);
  remotion(["render", "src/index.ts", "take-comment", "out/walkthrough.gif", "--codec", "gif", "--scale", "0.4", "--every-nth-frame", "5", "--log=error"]);
}

console.log(only ? `\nrendered out/${only}.mp4 + poster` : "\nrendered shorts + posters + long reel + readme gif in out/");
