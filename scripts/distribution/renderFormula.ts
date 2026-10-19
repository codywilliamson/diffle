// renders the Homebrew formula for a release: macOS and Linux, arm64 and x64, with release sha-256s.

import { PRODUCT } from "../../src/core/product";
import { assetUrl, cleanVersion, sha256For } from "./releaseInfo";

const LICENSE = "MIT";

function className(): string {
  return PRODUCT.name.charAt(0).toUpperCase() + PRODUCT.name.slice(1);
}

function urlAndSha(version: string, checksums: string, target: string): string[] {
  return [`      url "${assetUrl(version, target)}"`, `      sha256 "${sha256For(checksums, target)}"`];
}

function osBlock(os: "macos" | "linux", version: string, checksums: string): string[] {
  const slug = os === "macos" ? "darwin" : "linux";
  return [
    `  on_${os} do`,
    "    on_arm do",
    ...urlAndSha(version, checksums, `${slug}-arm64`),
    "    end",
    "    on_intel do",
    ...urlAndSha(version, checksums, `${slug}-x64`),
    "    end",
    "  end",
  ];
}

export function renderFormula(version: string, checksums: string): string {
  const v = cleanVersion(version);
  const lines = [
    `class ${className()} < Formula`,
    `  desc "${PRODUCT.description}"`,
    `  homepage "${PRODUCT.site}"`,
    `  license "${LICENSE}"`,
    "",
    ...osBlock("macos", v, checksums),
    "",
    ...osBlock("linux", v, checksums),
    "",
    "  def install",
    `    bin.install Dir["${PRODUCT.name}-*"].first => "${PRODUCT.name}"`,
    "  end",
    "",
    "  test do",
    `    assert_match version.to_s, shell_output("#{bin}/${PRODUCT.name} --version")`,
    "  end",
    "end",
  ];
  return `${lines.join("\n")}\n`;
}
