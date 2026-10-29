// copies the final renders + refreshed stills into the two places that consume them —
// docs/screenshots (README, github) and web/public/media (the nittle.dev site). the raw captures,
// shots and out/ renders stay gitignored; only these committed copies are shipped.
import { copyFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES } from "../src/scenes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const demos = join(here, "..");
const repoRoot = join(demos, "..");
const out = join(demos, "out");
const captures = join(demos, "public", "captures");
const shots = join(demos, "public", "shots");
const footage = join(demos, "public", "footage");

const docsShots = join(repoRoot, "docs", "screenshots");
const siteMedia = join(repoRoot, "web", "public", "media");
const docsGallery = join(docsShots, "gallery");
const siteGallery = join(siteMedia, "gallery");
const siteTakes = join(siteMedia, "takes");
for (const dir of [docsShots, siteMedia, docsGallery, siteGallery, siteTakes]) mkdirSync(dir, { recursive: true });

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

// the docs gallery: whatever `npm run shots` produced this run
const pngs = existsSync(shots) ? readdirSync(shots).filter((f) => f.endsWith(".png")) : [];
for (const png of pngs) copy(join(shots, png), png, [docsGallery, siteGallery]);

// one short + poster per take, so each guide page can embed its own clip
const takeIds = existsSync(footage) ? readdirSync(footage).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")) : [];
for (const id of takeIds) {
  copy(join(out, `${id}.mp4`), `${id}.mp4`, [siteTakes]);
  copy(join(out, `${id}.jpg`), `${id}.jpg`, [siteTakes]);
}

console.log("published demo media");
