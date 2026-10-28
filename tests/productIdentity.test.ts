import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT, repositorySlug } from "../src/core/product";
import { assetName } from "../src/core/updateTarget";
import { productEnv } from "../src/utils/env";
import { isProductBinary } from "../src/utils/installRoot";
import { helpFor, USAGE } from "../src/utils/usage";

const ROOT = join(import.meta.dir, "..");
const readJson = (path: string) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

describe("product identity derives from PRODUCT", () => {
  it("is nittle, with diffle as the migration-only legacy identity", () => {
    expect(PRODUCT.name).toBe("nittle");
    expect(PRODUCT.legacyName).toBe("diffle");
  });

  it("points at the renamed repo", () => {
    expect(PRODUCT.repository).toBe("https://github.com/codywilliamson/nittle");
    expect(repositorySlug()).toBe("codywilliamson/nittle");
  });

  it("derives binary, asset, plugin, env and data dir names from the name", () => {
    expect(assetName("linux-x64")).toBe(`${PRODUCT.name}-linux-x64`);
    expect(assetName("windows-x64")).toBe(`${PRODUCT.name}-windows-x64.exe`);
    expect(PRODUCT.plugin).toEqual({ name: `${PRODUCT.name}-review`, marketplace: `${PRODUCT.name}-local` });
    expect(PRODUCT.legacyPlugin).toEqual({ name: `${PRODUCT.legacyName}-review`, marketplace: `${PRODUCT.legacyName}-local` });
    expect(PRODUCT.envPrefix as string).toBe(`${PRODUCT.name.toUpperCase()}_`);
    expect(PRODUCT.legacyEnvPrefix as string).toBe(`${PRODUCT.legacyName.toUpperCase()}_`);
    expect(PRODUCT.dataDir).toBe(`.${PRODUCT.name}`);
    expect(PRODUCT.legacyDataDir).toBe(`.${PRODUCT.legacyName}`);
  });

  it("names the package bin after the product and nothing else", () => {
    expect(Object.keys(readJson("package.json").bin)).toEqual([PRODUCT.name]);
  });

  it("matches the plugin directories and manifests", () => {
    expect(readJson(".claude-plugin/marketplace.json").name).toBe(PRODUCT.plugin.marketplace);
    expect(readJson(".claude-plugin/marketplace.json").plugins[0].name).toBe(PRODUCT.plugin.name);
    expect(readJson(".agents/plugins/marketplace.json").plugins[0].name).toBe(PRODUCT.plugin.name);
    expect(readJson(`plugins/${PRODUCT.plugin.name}/.codex-plugin/plugin.json`).name).toBe(PRODUCT.plugin.name);
    expect(readJson(`integrations/claude-code/${PRODUCT.plugin.name}/.claude-plugin/plugin.json`).name).toBe(PRODUCT.plugin.name);
  });

  it("prints the product name in help", () => {
    expect(USAGE.startsWith(PRODUCT.name)).toBe(true);
    expect(helpFor("update")).toContain(`${PRODUCT.name} update`);
    expect(USAGE).not.toMatch(new RegExp(`\\b${PRODUCT.legacyName} (mcp|setup|update|doctor|cleanup|sessions)\\b`));
  });

  it("reads NITTLE_ env first and falls back to the legacy DIFFLE_ prefix", () => {
    const key = "IDENTITY_TEST_VALUE";
    const next = PRODUCT.envPrefix + key;
    const legacy = PRODUCT.legacyEnvPrefix + key;
    try {
      process.env[legacy] = "old";
      expect(productEnv(key)).toBe("old");
      process.env[next] = "new";
      expect(productEnv(key)).toBe("new");
    } finally {
      delete process.env[next];
      delete process.env[legacy];
    }
  });

  it("recognises the product binary and its transition-era legacy name only", () => {
    expect(isProductBinary("nittle")).toBe(true);
    expect(isProductBinary("Nittle.exe")).toBe(true);
    expect(isProductBinary("diffle-linux-x64")).toBe(true);
    expect(isProductBinary("loupe")).toBe(false);
    expect(isProductBinary("bun")).toBe(false);
  });
});
