// pure helpers for the self-updater and installer: which release asset this machine needs,
// how to read the checksum manifest, and whether a package manager owns this install.

import { PRODUCT } from "./product";

// the release target slug for a platform/arch, e.g. "windows-x64", "darwin-arm64".
export function platformTarget(platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
  const os = platform === "win32" ? "windows" : platform === "darwin" ? "darwin" : "linux";
  const cpu = arch === "arm64" ? "arm64" : "x64";
  return `${os}-${cpu}`;
}

// the per-target executable asset name, e.g. "diffle-windows-x64.exe".
export function assetName(target = platformTarget()): string {
  const ext = target.startsWith("windows") ? ".exe" : "";
  return `${PRODUCT.name}-${target}${ext}`;
}

// the sha-256 for `name` from a "checksums.txt" body ("<hex>  <name>" per line), or null.
export function parseChecksum(manifest: string, name: string): string | null {
  for (const line of manifest.split("\n")) {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line.trim());
    if (m && m[2] === name) return m[1]!.toLowerCase();
  }
  return null;
}

// name of the package manager that owns `execPath`, or null for a standalone install we may
// replace ourselves. self-update through a manager would fight the manager, so we refuse it.
export function detectPackageManager(execPath: string): string | null {
  const p = execPath.replace(/\\/g, "/").toLowerCase();
  if (p.includes("/homebrew/") || p.includes("/cellar/")) return "homebrew";
  if (p.includes("/scoop/")) return "scoop";
  if (p.includes("/winget") || p.includes("/windowsapps/")) return "winget";
  if (p.startsWith("/usr/") || p.startsWith("/nix/store/")) return "system package manager";
  return null;
}

// the command to update through a given manager.
export function managerCommand(manager: string): string {
  if (manager === "homebrew") return `brew upgrade ${PRODUCT.name}`;
  if (manager === "scoop") return `scoop update ${PRODUCT.name}`;
  if (manager === "winget") return `winget upgrade ${PRODUCT.name}`;
  return `use your package manager to upgrade ${PRODUCT.name}`;
}
