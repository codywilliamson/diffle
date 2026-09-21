// copies the repo-root installers into public/ so the built site serves them at
// diffle.dev/install and diffle.dev/install.ps1. the root scripts stay the source of truth.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const publicDir = join(here, "..", "public");

mkdirSync(publicDir, { recursive: true });
copyFileSync(join(repoRoot, "install.sh"), join(publicDir, "install"));
copyFileSync(join(repoRoot, "install.ps1"), join(publicDir, "install.ps1"));
console.log("copied install.sh → public/install and install.ps1 → public/install.ps1");
