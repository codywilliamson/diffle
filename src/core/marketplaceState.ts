// where the agent's `diffle-local` marketplace points: absent, our repo, someone else's source, or
// unknown (a file exists but can't be read or parsed). read-only; every source file may be missing.

import { readFileSync } from "node:fs";
import { isMissingFile } from "./mcpConfigFile";
import { PRODUCT, repositorySlug } from "./product";

export type MarketplaceState = "absent" | "ours" | "foreign" | "unknown";

const NAME: string = PRODUCT.plugin.marketplace;
const PRECEDENCE: MarketplaceState[] = ["foreign", "unknown", "ours", "absent"];

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;

const classify = (entry: string | undefined): MarketplaceState =>
  entry === undefined ? "absent" : entry.toLowerCase().includes(repositorySlug().toLowerCase()) ? "ours" : "foreign";

// claude's known_marketplaces.json keys marketplaces at the top level; settings.json nests them
// under extraKnownMarketplaces
function jsonEntry(text: string): string | undefined {
  const root = asObject(JSON.parse(text));
  const entry = root?.[NAME] ?? asObject(root?.extraKnownMarketplaces)?.[NAME];
  return entry === undefined ? undefined : JSON.stringify(entry);
}

// codex's config.toml: the `[marketplaces.<name>]` table, up to the next table header
function tomlEntry(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const headers = [`[marketplaces.${NAME}]`, `[marketplaces.${JSON.stringify(NAME)}]`];
  const start = lines.findIndex((line) => headers.includes(line.trim()));
  if (start === -1) return undefined;
  const end = lines.findIndex((line, i) => i > start && line.trim().startsWith("["));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

function stateOf(path: string): MarketplaceState {
  try {
    const text = readFileSync(path, "utf8");
    return classify(path.endsWith(".toml") ? tomlEntry(text) : jsonEntry(text));
  } catch (err) {
    return isMissingFile(err) ? "absent" : "unknown";
  }
}

export function marketplaceState(sources: string[]): MarketplaceState {
  const states = sources.map(stateOf);
  return PRECEDENCE.find((state) => states.includes(state)) ?? "absent";
}
