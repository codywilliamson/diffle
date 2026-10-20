// pure renderers for the npm package.json files and the bin shim (esbuild-style layout).

import { NPM_MAIN_PACKAGE, NPM_PLATFORMS, type NpmPlatform, npmPlatformPackage } from "../../src/core/npmPackage";
import { PRODUCT } from "../../src/core/product";
import { cleanVersion } from "./releaseInfo";

const LICENSE = "MIT";
const NODE_ENGINE = ">=18";
const SHIM_BIN = "bin/cli.js";

export const INSTALLER_HINT = `curl -fsSL ${PRODUCT.site}/install | sh (macOS/Linux) or pwsh -c "irm ${PRODUCT.site}/install.ps1 | iex" (Windows, needs PowerShell 7+)`;

const common = (version: string) => ({
  version: cleanVersion(version),
  license: LICENSE,
  homepage: PRODUCT.site,
  repository: { type: "git", url: `git+${PRODUCT.repository}.git` },
  author: PRODUCT.author.name,
  publishConfig: { access: "public", provenance: true },
});

export function platformPackageJson(p: NpmPlatform, version: string) {
  return {
    name: npmPlatformPackage(p),
    ...common(version),
    description: `${PRODUCT.name} binary for ${p.os} ${p.cpu}`,
    os: [p.os],
    cpu: [p.cpu],
    files: ["bin"],
  };
}

export function mainPackageJson(version: string) {
  const v = cleanVersion(version);
  return {
    name: NPM_MAIN_PACKAGE,
    ...common(v),
    description: PRODUCT.description,
    bin: { [PRODUCT.name]: SHIM_BIN },
    files: ["bin", "README.md"],
    engines: { node: NODE_ENGINE },
    optionalDependencies: Object.fromEntries(NPM_PLATFORMS.map((p) => [npmPlatformPackage(p), v])),
  };
}

export function renderShim(template: string): string {
  return template.replaceAll("__PACKAGE__", PRODUCT.name).replaceAll("__INSTALLER_HINT__", JSON.stringify(INSTALLER_HINT));
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
