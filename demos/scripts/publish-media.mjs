// copies the final rendered walkthrough + refreshed stills into the two places that consume
// them — docs/screenshots (README, github) and web/public/media (the diffle.dev site). the
// raw captures and out/ renders stay gitignored; only these committed copies are shipped.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/scenes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const demos = join(here, "..");
const repoRoot = join(demos, "..");
const out = join(demos, "out");
const captures = join(demos, "public", "captures");

const docsShots = join(repoRoot, "docs", "screenshots");
const siteMedia = join(repoRoot, "web", "public", "media");
mkdirSync(docsShots, { recursive: true });
mkdirSync(siteMedia, { recursive: true });

function copy(from, toName, dests) {
  if (!existsSync(from)) {
    console.warn(`skip (missing): ${from}`);
    return;
  }
  for (const dest of dests) {
    const target = join(dest, toName);
    copyFileSync(from, target);
    console.log(`→ ${target}`);
  }
}

const both = [docsShots, siteMedia];

// the walkthrough clip + poster (poster reuses the overview capture)
copy(join(out, "walkthrough.mp4"), "walkthrough.mp4", both);
copy(join(out, "walkthrough.gif"), "walkthrough.gif", [docsShots]); // gif is README-only
copy(join(captures, "overview.png"), "walkthrough-poster.png", both);

// refreshed per-scene stills
for (const scene of SCENES) {
  copy(join(captures, `${scene.id}.png`), `${scene.id}.png`, both);
}

console.log("published demo media");
