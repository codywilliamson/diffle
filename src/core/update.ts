// `diffle update`: download the matching asset from the latest GitHub Release, verify its
// sha-256 against the published checksum manifest, and swap the running binary. refuses when a
// package manager owns the install, or when running from a source checkout.

import { chmodSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { PRODUCT } from "./product";
import { checkForUpdate } from "./updateCheck";
import { assetName, detectPackageManager, managerCommand, parseChecksum } from "./updateTarget";
import { isProductBinary } from "../utils/installRoot";

const tag = `[${PRODUCT.name}]`;

function releaseAssetUrl(name: string, version: string): string {
  return `${PRODUCT.repository}/releases/download/v${version}/${name}`;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": PRODUCT.name }, redirect: "follow" });
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// unix can replace a running binary in place; windows locks it, so hand the swap to a detached
// helper that waits for this process to exit and then moves the staged file over the target.
function replaceBinary(bytes: Buffer): void {
  const target = process.execPath;
  const staged = join(dirname(target), `.${basename(target)}.new`);
  writeFileSync(staged, bytes);
  if (process.platform !== "win32") {
    chmodSync(staged, 0o755);
    renameSync(staged, target);
    return;
  }
  const ps = `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue; Move-Item -Force -LiteralPath '${staged}' -Destination '${target}'`;
  Bun.spawn(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps], { stdin: "ignore", stdout: "ignore", stderr: "ignore" }).unref();
}

export async function runUpdate(loupeRoot: string): Promise<void> {
  if (!isProductBinary(basename(process.execPath))) {
    return console.log(`${tag} 'update' applies to an installed ${PRODUCT.name} binary; in a source checkout, use git pull.`);
  }
  const manager = detectPackageManager(process.execPath);
  if (manager) return console.log(`${tag} installed via ${manager} — update with: ${managerCommand(manager)}`);

  const status = await checkForUpdate(loupeRoot);
  if (!status.behind) return console.log(`${tag} already on the latest release (v${status.current}).`);

  console.log(`${tag} updating v${status.current} → v${status.latest}…`);
  const exe = assetName();
  const [binary, checksums] = await Promise.all([
    download(releaseAssetUrl(exe, status.latest)),
    download(releaseAssetUrl("checksums.txt", status.latest)).then((b) => b.toString("utf8")),
  ]);
  const expected = parseChecksum(checksums, exe);
  if (!expected) throw new Error(`no checksum published for ${exe}`);
  const actual = createHash("sha256").update(binary).digest("hex");
  if (actual !== expected) throw new Error(`checksum mismatch for ${exe}`);

  replaceBinary(binary);
  const note = process.platform === "win32" ? " once this process exits" : "";
  console.log(`${tag} updated to v${status.latest}${note}. restart ${PRODUCT.name} to use it.`);
}
