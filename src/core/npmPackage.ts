// npm distribution layout: one thin main package plus one package per platform (esbuild style).
// shared by the staging script, the shim template and the updater's npm-install detection.

import { PRODUCT } from "./product";

export interface NpmPlatform {
  releaseTarget: string; // release asset slug, e.g. "windows-x64"
  os: "linux" | "darwin" | "win32"; // npm `os` field
  cpu: "x64" | "arm64"; // npm `cpu` field
}

export const NPM_PLATFORMS: readonly NpmPlatform[] = [
  { releaseTarget: "linux-x64", os: "linux", cpu: "x64" },
  { releaseTarget: "linux-arm64", os: "linux", cpu: "arm64" },
  { releaseTarget: "darwin-x64", os: "darwin", cpu: "x64" },
  { releaseTarget: "darwin-arm64", os: "darwin", cpu: "arm64" },
  { releaseTarget: "windows-x64", os: "win32", cpu: "x64" },
  { releaseTarget: "windows-arm64", os: "win32", cpu: "arm64" },
];

export const NPM_MAIN_PACKAGE = PRODUCT.name;

export function npmPlatformPackage(p: NpmPlatform): string {
  return `${PRODUCT.name}-${p.os}-${p.cpu}`;
}

// matches .../node_modules/nittle-<os>-<cpu>/... for npm, pnpm and yarn layouts
const PLATFORM_DIR = new RegExp(`/node_modules/${PRODUCT.name}-(linux|darwin|win32)-(x64|arm64)/`);

export function isNpmInstalledPath(execPath: string): boolean {
  return PLATFORM_DIR.test(execPath.replaceAll("\\", "/").toLowerCase());
}
