// unsent comment drafts, kept under <data dir>/drafts/ so they outlive a closed tab and the
// random port of the next launch (localStorage is per origin). one file per review scope, written
// to a temp file and renamed into place, so a crash or a second process can never leave a torn
// file or wipe another review's drafts. bounded so a forgotten draft can't grow without limit.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CommentDrafts, DraftUpdate, RejectedDraft } from "../types";
import { homeDataDir } from "./dataDir";

const DRAFTS_DIR = "drafts";
const SCOPE_FILE_SUFFIX = ".json";
export const MAX_DRAFT_TEXT = 100_000;
export const MAX_DRAFT_KEY = 512;
export const MAX_DRAFTS_PER_REVIEW = 200;
export const MAX_DRAFT_SCOPES = 50;
export const DRAFT_TOO_LONG = "draft too long to save";
export const DRAFT_KEY_INVALID = "draft has no usable key";
export const DRAFT_LIMIT_REACHED = "too many drafts for this review";

interface ScopeFile {
  scope: string;
  drafts: Record<string, string>;
}

const dirOf = (home: string): string => join(homeDataDir(home), DRAFTS_DIR);
const fileOf = (home: string, scope: string): string =>
  join(dirOf(home), `${createHash("sha256").update(scope).digest("hex").slice(0, 32)}${SCOPE_FILE_SUFFIX}`);

// a Map, so a key like __proto__ is just a key
function readScope(path: string, scope: string): Map<string, string> {
  const drafts = new Map<string, string>();
  if (!existsSync(path)) return drafts;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ScopeFile> | null;
    if (parsed?.scope !== scope || !parsed.drafts || typeof parsed.drafts !== "object") return drafts;
    for (const [key, text] of Object.entries(parsed.drafts)) if (typeof text === "string") drafts.set(key, text);
  } catch {
    // torn or corrupt: this scope starts over, nothing else is touched
  }
  return drafts;
}

const toRecord = (drafts: Map<string, string>): CommentDrafts => Object.fromEntries(drafts);

export function readDrafts(scope: string, home = homedir()): CommentDrafts {
  return toRecord(readScope(fileOf(home, scope), scope));
}

function dropOldestScopes(home: string, keep: string): void {
  const dir = dirOf(home);
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(SCOPE_FILE_SUFFIX))
    .map((name) => ({ path: join(dir, name), at: statSync(join(dir, name)).mtimeMs }));
  files
    .filter((file) => file.path !== keep)
    .sort((a, b) => b.at - a.at)
    .slice(MAX_DRAFT_SCOPES - 1)
    .forEach((file) => rmSync(file.path, { force: true }));
}

function atomicWrite(path: string, content: string): void {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content);
  renameSync(temp, path);
}

function rejectionFor(update: DraftUpdate, drafts: Map<string, string>): string | null {
  if (!update.key || update.key.length > MAX_DRAFT_KEY) return DRAFT_KEY_INVALID;
  if (update.text.length > MAX_DRAFT_TEXT) return DRAFT_TOO_LONG;
  if (update.text !== "" && !drafts.has(update.key) && drafts.size >= MAX_DRAFTS_PER_REVIEW) return DRAFT_LIMIT_REACHED;
  return null;
}

// applies each update on its own: empty text removes a draft, a refused one is reported and the rest still land
export function writeDrafts(scope: string, updates: DraftUpdate[], home = homedir()): { drafts: CommentDrafts; rejected: RejectedDraft[] } {
  const path = fileOf(home, scope);
  const drafts = readScope(path, scope);
  const rejected: RejectedDraft[] = [];
  for (const update of updates) {
    const reason = rejectionFor(update, drafts);
    if (reason) rejected.push({ key: update.key, reason });
    else if (update.text === "") drafts.delete(update.key);
    else drafts.set(update.key, update.text);
  }
  mkdirSync(dirOf(home), { recursive: true });
  if (drafts.size === 0) rmSync(path, { force: true });
  else atomicWrite(path, `${JSON.stringify({ scope, drafts: toRecord(drafts) } satisfies ScopeFile)}\n`);
  dropOldestScopes(home, path);
  return { drafts: toRecord(drafts), rejected };
}
