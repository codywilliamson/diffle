// runs the visual snapshot suite inside the pinned playwright image, so fonts, rasterizer and
// chromium match CI byte for byte. CI calls this same script, so local and CI output are the same.
//
//   bun run test:e2e:docker           compare against the committed baselines
//   bun run test:e2e:docker:update    rewrite the baselines (review the diff images, then commit)
//
// extra args after the flags go to playwright, e.g. `bun scripts/e2e-docker.ts -g "scorecard"`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const IMAGE_REPO = "mcr.microsoft.com/playwright";
const IMAGE_FLAVOR = "noble";
const BUN_VERSION = "1.3.14"; // keep in step with the setup-bun pin in the workflows
const WORKDIR = "/work";
const NODE_MODULES_VOLUME = "nittle-e2e-node-modules"; // linux deps stay off the host checkout
const BUN_CACHE_VOLUME = "nittle-e2e-bun-cache";
const UPDATE_FLAG = "--update";

// the image tag must be the exact installed playwright version or the browsers won't match.
function playwrightVersion(): string {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as { devDependencies: Record<string, string> };
  const pinned = manifest.devDependencies["@playwright/test"];
  if (!pinned || !/^\d+\.\d+\.\d+$/.test(pinned)) throw new Error(`@playwright/test must be an exact version, got "${pinned}"`);
  return pinned;
}

const imageTag = (): string => `${IMAGE_REPO}:v${playwrightVersion()}-${IMAGE_FLAVOR}`;

function innerCommand(playwrightArgs: string[]): string {
  const args = playwrightArgs.map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");
  return [
    "set -euo pipefail",
    "git config --global --add safe.directory '*'",
    "command -v git >/dev/null || (apt-get update -qq && apt-get install -y -qq git)",
    `npm install -g --silent bun@${BUN_VERSION}`,
    "bun install --frozen-lockfile",
    `bun run test:e2e:visual -- ${args}`,
  ].join("\n");
}

function main(): number {
  const argv = process.argv.slice(2);
  const update = argv.includes(UPDATE_FLAG);
  const passthrough = argv.filter((a) => a !== UPDATE_FLAG);
  const playwrightArgs = update ? ["--update-snapshots=all", ...passthrough] : passthrough;

  if (spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "ignore" }).status !== 0) {
    console.error("docker is not available. start Docker (Desktop on Windows/macOS) and retry.");
    return 1;
  }

  const image = imageTag();
  console.log(`[e2e-docker] ${image}${update ? " (updating snapshots)" : ""}`);
  const run = spawnSync(
    "docker",
    [
      "run", "--rm", "--ipc=host",
      "-v", `${REPO_ROOT}:${WORKDIR}`,
      "-v", `${NODE_MODULES_VOLUME}:${WORKDIR}/node_modules`,
      "-v", `${BUN_CACHE_VOLUME}:/root/.bun/install/cache`,
      "-w", WORKDIR,
      "-e", "CI=1",
      image,
      "bash", "-c", innerCommand(playwrightArgs),
    ],
    { stdio: "inherit" },
  );
  return run.status ?? 1;
}

process.exit(main());
