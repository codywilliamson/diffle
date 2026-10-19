import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NPM_PLATFORMS, npmPlatformPackage } from "../src/core/npmPackage";
import { renderFormula } from "../scripts/distribution/renderFormula";
import { json, mainPackageJson, platformPackageJson, renderShim } from "../scripts/distribution/renderNpm";
import { renderScoop } from "../scripts/distribution/renderScoop";

const checksums = readFileSync(join(import.meta.dir, "fixtures", "distribution", "checksums.txt"), "utf8");
const VERSION = "1.2.3";

describe("homebrew formula", () => {
  it("matches the snapshot", () => {
    expect(renderFormula(`v${VERSION}`, checksums)).toMatchSnapshot();
  });

  it("uses the release sha for every platform", () => {
    const formula = renderFormula(VERSION, checksums);
    for (const t of ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"]) {
      const sha = checksums.split("\n").find((l) => l.endsWith(`  nittle-${t}`))!.split(" ")[0]!;
      expect(formula).toContain(`sha256 "${sha}"`);
      expect(formula).toContain(`/v${VERSION}/nittle-${t}"`);
    }
  });

  it("marks every url nounzip because the assets are raw executables", () => {
    const urls = renderFormula(VERSION, checksums).split("\n").filter((l) => l.trim().startsWith("url "));
    expect(urls).toHaveLength(4);
    for (const line of urls) expect(line).toEndWith(", using: :nounzip");
  });

  it("fails loudly when a checksum is missing", () => {
    expect(() => renderFormula(VERSION, checksums.split("\n").filter((l) => !l.includes("darwin-x64")).join("\n"))).toThrow(
      "nittle-darwin-x64",
    );
  });
});

describe("scoop manifest", () => {
  it("matches the snapshot", () => {
    expect(renderScoop(VERSION, checksums)).toMatchSnapshot();
  });

  it("is valid json with both architectures, checkver and autoupdate", () => {
    const m = JSON.parse(renderScoop(VERSION, checksums));
    expect(Object.keys(m.architecture)).toEqual(["64bit", "arm64"]);
    expect(m.checkver.github).toStartWith("https://github.com/");
    expect(Object.keys(m.autoupdate.architecture)).toEqual(["64bit", "arm64"]);
    expect(m.architecture["64bit"].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.bin).toBe("nittle.exe");
  });
});

describe("npm packages", () => {
  it("renders the main package.json", () => {
    expect(json(mainPackageJson(`v${VERSION}`))).toMatchSnapshot();
  });

  it("pins every platform package as an optional dependency at the release version", () => {
    const deps = mainPackageJson(VERSION).optionalDependencies;
    expect(Object.keys(deps)).toEqual(NPM_PLATFORMS.map(npmPlatformPackage));
    expect(new Set(Object.values(deps))).toEqual(new Set([VERSION]));
  });

  it("renders one package.json per platform with os and cpu", () => {
    const all = NPM_PLATFORMS.map((p) => platformPackageJson(p, VERSION));
    expect(json(all)).toMatchSnapshot();
    expect(all.map((p) => p.name)).toContain("nittle-win32-arm64");
  });

  it("fills the shim placeholders and names the installer as the fallback", () => {
    const shim = renderShim(readFileSync(join(import.meta.dir, "..", "npm", "bin", "cli.js"), "utf8"));
    expect(shim).not.toContain("__PACKAGE__");
    expect(shim).not.toContain("__INSTALLER_HINT__");
    expect(shim).toContain("https://nittle.dev/install");
    expect(shim).toContain("irm https://nittle.dev/install.ps1");
  });
});
