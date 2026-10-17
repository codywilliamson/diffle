// installs the real diffle 0.28.1 with the 0.28.1 installer, taken from the v0.28.1 tag. the
// installer only ever asks for `releases/latest`, which stops being 0.28.1 once a nittle release
// exists, so the one url is pinned to that tag; everything else is the installer as shipped.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXE, run, WINDOWS, type Sandbox } from "./sandbox";

export const OLD_VERSION = "0.28.1";
const OLD_TAG = `v${OLD_VERSION}`;
const RAW = `https://raw.githubusercontent.com/codywilliamson/diffle/${OLD_TAG}`;
const LATEST = "releases/latest";
const PINNED = `releases/tags/${OLD_TAG}`;

async function fetchInstaller(name: string, repoRoot: string): Promise<string> {
  const res = await fetch(`${RAW}/${name}`, { headers: { "User-Agent": "nittle-upgrade-smoke" } });
  if (res.ok) return res.text();
  const local = Bun.spawnSync(["git", "show", `${OLD_TAG}:${name}`], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  if (local.exitCode !== 0) throw new Error(`could not get ${name} at ${OLD_TAG} (raw: ${res.status}; git: ${local.stderr.toString().trim()})`);
  return local.stdout.toString();
}

export interface OldInstall { binary: string; binDir: string; }

export async function installOldDiffle(box: Sandbox, repoRoot: string): Promise<OldInstall> {
  const name = WINDOWS ? "install.ps1" : "install.sh";
  const script = (await fetchInstaller(name, repoRoot)).replaceAll("\r\n", "\n");
  if (!script.includes(LATEST)) throw new Error(`${name} at ${OLD_TAG} no longer asks for ${LATEST}; update installOld.ts`);
  const dir = join(box.root, "old-installer");
  mkdirSync(dir);
  const file = join(dir, name);
  writeFileSync(file, script.replaceAll(LATEST, PINNED));

  const binDir = join(box.home, ".diffle", "bin");
  // DIFFLE_NO_SETUP: the installer would otherwise offer agent setup on a terminal.
  // powershell derives $HOME from the account, not USERPROFILE, so pin the bin dir explicitly.
  const env = box.env({ DIFFLE_NO_SETUP: "1", ...(WINDOWS ? { DIFFLE_INSTALL_DIR: binDir } : {}), ...(process.env.GITHUB_TOKEN ? { GITHUB_TOKEN: process.env.GITHUB_TOKEN } : {}) });
  const result = WINDOWS ? run("pwsh", ["-NoProfile", "-File", file], env, dir) : run("sh", [file], env, dir);
  if (result.code !== 0) throw new Error(`the ${OLD_TAG} installer exited ${result.code}`);

  const binary = join(binDir, `diffle${EXE}`);
  const version = run(binary, ["--version"], box.env({ DIFFLE_NO_UPDATE_CHECK: "1" }), box.home).stdout.split("\n")[0]?.trim();
  if (version !== `diffle ${OLD_TAG}`) throw new Error(`installed binary reports "${version}", expected "diffle ${OLD_TAG}"`);
  return { binary, binDir };
}
