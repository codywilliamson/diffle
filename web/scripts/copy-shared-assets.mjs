// copies repo-owned files into public/ so the built site serves them: the root installers at
// diffle.dev/install + /install.ps1, and the client's brand icons. the originals stay the source of truth.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const publicDir = join(here, "..", "public");
const clientPublic = join(repoRoot, "client", "public");

const COPIES = [
  [join(repoRoot, "install.sh"), "install"],
  [join(repoRoot, "install.ps1"), "install.ps1"],
  [join(clientPublic, "favicon.svg"), "favicon.svg"],
  [join(clientPublic, "apple-touch-icon.png"), "apple-touch-icon.png"],
];

mkdirSync(publicDir, { recursive: true });
for (const [from, to] of COPIES) copyFileSync(from, join(publicDir, to));
console.log(`copied ${COPIES.map(([, to]) => to).join(", ")} → public/`);
