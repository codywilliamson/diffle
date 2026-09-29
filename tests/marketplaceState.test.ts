import { afterEach, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { marketplaceState, normalizeRepo } from "../src/core/marketplaceState";
import { PRODUCT, repositorySlug } from "../src/core/product";
import { cleanupTempDirs, tempDir } from "./helpers/claudeConfig";

afterEach(cleanupTempDirs);

const NAME = PRODUCT.plugin.marketplace;
const github = (repo: string) => ({ source: { source: "github", repo } });

function file(name: string, body: string): string {
  const path = join(tempDir(), name);
  writeFileSync(path, body);
  return path;
}

test("missing files are absent", () => {
  expect(marketplaceState([join(tempDir(), "none.json"), join(tempDir(), "none.toml")])).toBe("absent");
});

test("claude known_marketplaces.json: ours, foreign, or absent", () => {
  expect(marketplaceState([file("k.json", JSON.stringify({ [NAME]: github(repositorySlug()) }))])).toBe("ours");
  expect(marketplaceState([file("k.json", JSON.stringify({ [NAME]: github("someone/else") }))])).toBe("foreign");
  expect(marketplaceState([file("k.json", JSON.stringify({ other: github(repositorySlug()) }))])).toBe("absent");
});

test("claude settings.json extraKnownMarketplaces counts too", () => {
  const settings = file("settings.json", JSON.stringify({ extraKnownMarketplaces: { [NAME]: github(repositorySlug()) } }));
  expect(marketplaceState([join(tempDir(), "none.json"), settings])).toBe("ours");
});

test("codex config.toml table, bare or quoted, bounded by the next table", () => {
  const ours = `[marketplaces.${NAME}]\nsource = "https://github.com/${repositorySlug()}.git"\n\n[other]\nx = 1\n`;
  expect(marketplaceState([file("c.toml", ours)])).toBe("ours");
  const quoted = `[marketplaces."${NAME}"]\nsource = "https://example.com/elsewhere"\n[mcp]\nsource = "${repositorySlug()}"\n`;
  expect(marketplaceState([file("c.toml", quoted)])).toBe("foreign");
  expect(marketplaceState([file("c.toml", `[marketplaces.other]\nsource = "${repositorySlug()}"\n`)])).toBe("absent");
});

test("repos match exactly after normalizing url forms", () => {
  const slug = repositorySlug();
  for (const form of [slug, `https://github.com/${slug}`, `https://github.com/${slug}.git/`, `git@github.com:${slug}.git`, slug.toUpperCase()]) {
    expect(normalizeRepo(form)).toBe(slug.toLowerCase());
  }
  for (const lookalike of [`${slug}-malicious`, `evil/${slug}`, `https://github.com/${slug}x`]) {
    expect(marketplaceState([file("k.json", JSON.stringify({ [NAME]: github(lookalike) }))])).toBe("foreign");
  }
  const url = { source: { source: "git", url: `https://github.com/${slug}.git` } };
  expect(marketplaceState([file("k.json", JSON.stringify({ [NAME]: url }))])).toBe("ours");
  expect(marketplaceState([file("k.json", JSON.stringify({ [NAME]: { note: slug } }))])).toBe("foreign");
  const lookalikeToml = `[marketplaces.${NAME}]\nsource = "https://github.com/${slug}-malicious"\n`;
  expect(marketplaceState([file("c.toml", lookalikeToml)])).toBe("foreign");
  expect(marketplaceState([file("c.toml", `[marketplaces.${NAME}]\nnote = "${slug}"\n`)])).toBe("foreign");
});

test("unreadable or unparseable is unknown; foreign wins over everything", () => {
  const dir = join(tempDir(), "dir.json");
  mkdirSync(dir);
  expect(marketplaceState([dir])).toBe("unknown");
  expect(marketplaceState([file("bad.json", "{ nope")])).toBe("unknown");
  const foreign = file("k.json", JSON.stringify({ [NAME]: github("someone/else") }));
  const ours = file("s.json", JSON.stringify({ extraKnownMarketplaces: { [NAME]: github(repositorySlug()) } }));
  expect(marketplaceState([ours, dir, foreign])).toBe("foreign");
});
