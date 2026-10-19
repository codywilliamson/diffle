// renders the Scoop manifest for a release: windows x64 and arm64, with checkver and autoupdate.

import { PRODUCT } from "../../src/core/product";
import { assetName } from "../../src/core/updateTarget";
import { cleanVersion, releaseBaseUrl, sha256For } from "./releaseInfo";

const LICENSE = "MIT";
const TARGETS = { "64bit": "windows-x64", arm64: "windows-arm64" } as const;
const AUTOUPDATE_BASE = `${PRODUCT.repository}/releases/download/v$version`;

// the #/name.exe fragment makes scoop save the raw binary under the command name
function fileUrl(base: string, target: string): string {
  return `${base}/${assetName(target)}#/${PRODUCT.name}.exe`;
}

function autoupdateEntry(target: string) {
  const escaped = assetName(target).replaceAll(".", "\\.");
  return {
    url: fileUrl(AUTOUPDATE_BASE, target),
    hash: { url: `${AUTOUPDATE_BASE}/checksums.txt`, regex: `$sha256\\s+${escaped}` },
  };
}

export function renderScoop(version: string, checksums: string): string {
  const v = cleanVersion(version);
  const architecture: Record<string, unknown> = {};
  const autoupdate: Record<string, unknown> = {};
  for (const [arch, target] of Object.entries(TARGETS)) {
    architecture[arch] = { url: fileUrl(releaseBaseUrl(v), target), hash: sha256For(checksums, target) };
    autoupdate[arch] = autoupdateEntry(target);
  }
  const manifest = {
    version: v,
    description: PRODUCT.description,
    homepage: PRODUCT.site,
    license: LICENSE,
    architecture,
    bin: `${PRODUCT.name}.exe`,
    checkver: { github: PRODUCT.repository },
    autoupdate: { architecture: autoupdate },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
