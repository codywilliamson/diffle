// `diffle update`: download the matching asset from the latest GitHub Release, verify its
// sha-256 against the published checksum manifest, swap the running binary, then stop idle MCP
// servers so agents relaunch them on the new version. refuses when a package manager owns the
// install, or when running from a source checkout.

import { chmodSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { PRODUCT } from "./product";
import { checkForUpdate } from "./updateCheck";
import { fetchReleaseStatus, updateCheckReport } from "./updateNotice";
import { assetName, detectPackageManager, managerCommand, parseChecksum } from "./updateTarget";
import { isProductBinary } from "../utils/installRoot";
import { restartMcpAfterUpdate } from "../utils/mcpCli";

const tag = `[${PRODUCT.name}]`;

function releaseAssetUrl(name: string, version: string): string {
  return `${PRODUCT.repository}/releases/download/v${version}/${name}`;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": PRODUCT.name }, redirect: "follow" });
  if (!res.ok) throw new Error(`download failed (${res.status}) for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// unix can replace a running binary in place. windows locks a running exe (this process and any
// MCP server) against overwrite but not rename, so move it aside first; the next update removes
// the retired copy.
function replaceBinary(bytes: Buffer): void {
  const target = process.execPath;
  const sibling = (suffix: string) => join(dirname(target), `.${basename(target)}.${suffix}`);
  const staged = sibling("new");
  writeFileSync(staged, bytes);
  if (process.platform !== "win32") {
    chmodSync(staged, 0o755);
    renameSync(staged, target);
    return;
  }
  const retired = sibling("old");
  rmSync(retired, { force: true });
  renameSync(target, retired);
  renameSync(staged, target);
}

// `update --check`: report only, never download. works in a source checkout too.
async function reportUpdate(loupeRoot: string): Promise<void> {
  console.log(`${tag} ${updateCheckReport(await fetchReleaseStatus(loupeRoot))}`);
}

export async function runUpdate(loupeRoot: string, check = false): Promise<void> {
  if (check) return reportUpdate(loupeRoot);
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
  console.log(`${tag} updated to v${status.latest}. restart any open ${PRODUCT.name} review to use it.`);
  await restartMcpAfterUpdate(process.execPath);
}
