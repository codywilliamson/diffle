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

// an entry's source: undefined = no entry, null = an entry whose source can't be read
type Source = string | null | undefined;

// `owner/repo`, `https://github.com/owner/repo(.git)`, `git@github.com:owner/repo.git` → owner/repo
export function normalizeRepo(source: string): string {
  return source.trim().toLowerCase()
    .replace(/^(?:https?:\/\/|ssh:\/\/)?(?:git@)?github\.com[/:]/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
}

// exact match only — a substring check would accept owner/diffle-anything
const classify = (source: Source): MarketplaceState =>
  source === undefined ? "absent" : source !== null && normalizeRepo(source) === repositorySlug().toLowerCase() ? "ours" : "foreign";

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

// claude's known_marketplaces.json keys marketplaces at the top level; settings.json nests them
// under extraKnownMarketplaces. the source is `{ source: "github", repo }` or `{ source: "git", url }`
function jsonSource(text: string): Source {
  const root = asObject(JSON.parse(text));
  const entry = root?.[NAME] ?? asObject(root?.extraKnownMarketplaces)?.[NAME];
  if (entry === undefined) return undefined;
  const source = asObject(asObject(entry)?.source);
  return str(source?.repo) ?? str(source?.url) ?? null;
}

// codex's config.toml: the `source = "…"` line of the `[marketplaces.<name>]` table
function tomlSource(text: string): Source {
  const lines = text.split(/\r?\n/);
  const headers = [`[marketplaces.${NAME}]`, `[marketplaces.${JSON.stringify(NAME)}]`];
  const start = lines.findIndex((line) => headers.includes(line.trim()));
  if (start === -1) return undefined;
  const end = lines.findIndex((line, i) => i > start && line.trim().startsWith("["));
  const table = lines.slice(start + 1, end === -1 ? undefined : end);
  for (const line of table) {
    const match = /^\s*source\s*=\s*(["'])(.*)\1\s*$/.exec(line);
    if (match) return match[2]!;
  }
  return null;
}

function stateOf(path: string): MarketplaceState {
  try {
    const text = readFileSync(path, "utf8");
    return classify(path.endsWith(".toml") ? tomlSource(text) : jsonSource(text));
  } catch (err) {
    return isMissingFile(err) ? "absent" : "unknown";
  }
}

// install's view: any conflicting entry wins, so setup never trusts a mixed registration
export function marketplaceState(sources: string[]): MarketplaceState {
  const states = sources.map(stateOf);
  return PRECEDENCE.find((state) => states.includes(state)) ?? "absent";
}

// teardown's view: any source still ours (or unreadable) means there's something left to remove
export function hasOurMarketplace(sources: string[]): boolean {
  return sources.map(stateOf).some((state) => state === "ours" || state === "unknown");
}
