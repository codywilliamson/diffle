// unsent comment drafts, kept in <data dir>/drafts.json so they outlive a closed tab and the
// random port of the next launch (localStorage is per origin). scoped per review; bounded so a
// forgotten draft can never grow the file without limit.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CommentDrafts } from "../types";
import { homeDataDir } from "./dataDir";

const DRAFTS_FILE = "drafts.json";
export const MAX_DRAFT_TEXT = 100_000;
export const MAX_DRAFT_KEY = 512;
export const MAX_DRAFTS_PER_REVIEW = 200;
export const MAX_DRAFT_SCOPES = 50;

interface Scope {
  updatedAt: string;
  drafts: CommentDrafts;
}
type DraftFile = Record<string, Scope>;

const filePath = (home: string): string => join(homeDataDir(home), DRAFTS_FILE);

function readFile(home: string): DraftFile {
  const path = filePath(home);
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as DraftFile) : {};
  } catch {
    return {};
  }
}

export function readDrafts(scope: string, home = homedir()): CommentDrafts {
  return readFile(home)[scope]?.drafts ?? {};
}

// empty text removes the draft. returns the scope's drafts, or an error string for an over-cap write.
export function writeDraft(scope: string, key: string, text: string, home = homedir()): CommentDrafts | string {
  if (!key || key.length > MAX_DRAFT_KEY) return "draft key is empty or too long";
  if (text.length > MAX_DRAFT_TEXT) return "draft is too long";
  const file = readFile(home);
  const drafts = { ...file[scope]?.drafts };
  if (text === "") delete drafts[key];
  else if (key in drafts || Object.keys(drafts).length < MAX_DRAFTS_PER_REVIEW) drafts[key] = text;
  else return "too many drafts for this review";
  if (Object.keys(drafts).length === 0) delete file[scope];
  else file[scope] = { updatedAt: new Date().toISOString(), drafts };
  const kept = Object.entries(file)
    .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_DRAFT_SCOPES);
  mkdirSync(homeDataDir(home), { recursive: true });
  writeFileSync(filePath(home), `${JSON.stringify(Object.fromEntries(kept), null, 2)}\n`);
  return drafts;
}
