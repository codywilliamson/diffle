// shared building blocks for the language adapters' flag rules and path conventions.

import { relative, resolve } from "node:path";
import type { ChangeFlag, DiffFile } from "../../../types";
import type { ReviewGroupKey } from "./adapter";

export const ROOT_GROUP = "(root)";

// true when `dir` (absolute) is root or sits under it
export const isInside = (root: string, dir: string): boolean => {
  const rel = relative(root, dir);
  return !rel.startsWith("..") && resolve(root, rel) === dir;
};

const SNIPPET_MAX = 60;

export interface LineRef {
  line: number;
  text: string;
}

export function addedLines(file: DiffFile): LineRef[] {
  return linesOf(file, "addition");
}

export function deletedLines(file: DiffFile): LineRef[] {
  return linesOf(file, "deletion");
}

function linesOf(file: DiffFile, type: "addition" | "deletion"): LineRef[] {
  const out: LineRef[] = [];
  for (const hunk of file.hunks) {
    for (const l of hunk.lines) {
      const line = type === "addition" ? l.newLine : l.oldLine;
      if (l.type === type && line != null) out.push({ line, text: l.content });
    }
  }
  return out;
}

export const segmentsOf = (path: string): string[] => path.replace(/\\/g, "/").split("/").filter(Boolean);
export const baseName = (path: string): string => segmentsOf(path).at(-1) ?? "";
export const stemOf = (name: string): string => name.replace(/\.[^./]*$/, "");
export const dirSegments = (path: string): string[] => segmentsOf(path).slice(0, -1);

export function topLevelGroup(path: string): ReviewGroupKey {
  const segs = segmentsOf(path);
  const id = segs.length > 1 ? segs[0]! : ROOT_GROUP;
  return { id, label: id };
}

// ── leftover rules ───────────────────────────────────────────────────────────

export interface LineRule {
  re: RegExp;
  reason: string;
  comment?: boolean; // true = also fires on comment lines (todo markers, suppression comments)
}

export const TODO_RULE: LineRule = { re: /\b(TODO|FIXME|HACK)\b/, reason: "unfinished-work marker", comment: true };

const isCommentLine = (text: string): boolean => /^\s*(\/\/|\/\*|\*|#)/.test(text);
const snippet = (text: string): string => text.trim().slice(0, SNIPPET_MAX);

export function leftoverFlags(file: DiffFile, rules: LineRule[]): ChangeFlag[] {
  const flags: ChangeFlag[] = [];
  for (const { line, text } of addedLines(file)) {
    const rule = rules.find((r) => (r.comment || !isCommentLine(text)) && r.re.test(text));
    if (rule) flags.push({ kind: "leftover", reason: `${rule.reason} added: \`${snippet(text)}\``, line });
  }
  return flags;
}

// ── sensitive paths ──────────────────────────────────────────────────────────

const AUTH_SEGMENTS = new Set(["auth", "authentication", "authorization", "security"]);
const CI_FILES = new Set([".gitlab-ci.yml", "azure-pipelines.yml", "jenkinsfile"]);

export function genericSensitiveReason(path: string): string | null {
  const segs = segmentsOf(path);
  const name = (segs.at(-1) ?? "").toLowerCase();
  const stems = segs.map((s, i) => (i === segs.length - 1 ? stemOf(s) : s).toLowerCase());
  const norm = segs.join("/").toLowerCase();
  if (norm.includes(".github/workflows/")) return "CI workflow";
  if (CI_FILES.has(name)) return "CI pipeline";
  if (name.startsWith("dockerfile") || name.endsWith(".dockerfile") || name.startsWith("docker-compose")) {
    return "container build or deploy config";
  }
  if (name === ".env" || name.startsWith(".env.")) return "environment config";
  if (stems.some((s) => s.includes("migration"))) return "database migration";
  if (stems.some((s) => AUTH_SEGMENTS.has(s))) return "auth or security code";
  return null;
}

// extra is a language-specific check tried before the generic list; one flag per file
export function sensitiveFlags(path: string, extra?: (path: string) => string | null): ChangeFlag[] {
  const why = extra?.(path) ?? genericSensitiveReason(path);
  return why ? [{ kind: "sensitive-path", reason: `sensitive path: ${why}`, line: null }] : [];
}

export function commonFlags(file: DiffFile, extra?: (path: string) => string | null): ChangeFlag[] {
  return [...sensitiveFlags(file.path, extra), ...leftoverFlags(file, [TODO_RULE])];
}
