// compares declarations seen on the deleted side with those on the added side, so a signature
// that merely moved (present on both sides) never counts as a change.

import type { ChangeFlag, DiffFile } from "../../../types";
import { addedLines, deletedLines, type LineRef } from "./flagHelpers";

export interface Declaration {
  key: string; // identity: equal keys on both sides cancel out
  label: string; // plain-english, e.g. "method `GetUser(int id)`"
}

export type DeclParser = (text: string) => Declaration | null;

function parseAll(lines: LineRef[], parse: DeclParser): Map<string, LineRef & Declaration> {
  const out = new Map<string, LineRef & Declaration>();
  for (const ref of lines) {
    const decl = parse(ref.text);
    if (decl && !out.has(decl.key)) out.set(decl.key, { ...ref, ...decl });
  }
  return out;
}

export function apiFlags(file: DiffFile, parse: DeclParser): ChangeFlag[] {
  const added = parseAll(addedLines(file), parse);
  const removed = parseAll(deletedLines(file), parse);
  const flags: ChangeFlag[] = [];
  for (const [key, d] of removed) {
    if (!added.has(key)) flags.push({ kind: "public-api-removed", reason: `removed ${d.label}`, line: d.line });
  }
  for (const [key, d] of added) {
    if (!removed.has(key)) flags.push({ kind: "public-api-added", reason: `added ${d.label}`, line: d.line });
  }
  return flags;
}

export interface DependencyEntry {
  name: string;
  version: string;
}

// sees every line on one side of a hunk in order (context included), so it may remember an open element;
// only entries parsed from changed lines are reported
export type DependencyParser = (text: string) => DependencyEntry | null;
export type DependencyParserFactory = () => DependencyParser;

function entriesOf(file: DiffFile, side: "addition" | "deletion", makeParser: DependencyParserFactory): Map<string, LineRef & DependencyEntry> {
  const out = new Map<string, LineRef & DependencyEntry>();
  for (const hunk of file.hunks) {
    const parse = makeParser();
    for (const l of hunk.lines) {
      const line = side === "addition" ? l.newLine : l.oldLine;
      if (line == null || (l.type !== side && l.type !== "context")) continue;
      const entry = parse(l.content);
      if (entry && l.type === side) out.set(entry.name, { line, text: l.content, ...entry });
    }
  }
  return out;
}

const shown = (version: string): string => (version ? ` ${version}` : "");

export function dependencyFlags(file: DiffFile, makeParser: DependencyParserFactory): ChangeFlag[] {
  const added = entriesOf(file, "addition", makeParser);
  const removed = entriesOf(file, "deletion", makeParser);
  const flags: ChangeFlag[] = [];
  const flag = (reason: string, line: number): void => {
    flags.push({ kind: "dependency", reason, line });
  };
  for (const [name, a] of added) {
    const old = removed.get(name);
    if (!old) flag(`added dependency ${name}${shown(a.version)}`, a.line);
    else if (old.version !== a.version) {
      flag(`changed dependency ${name} from ${old.version || "(none)"} to ${a.version || "(none)"}`, a.line);
    }
  }
  for (const [name, r] of removed) {
    if (!added.has(name)) flag(`removed dependency ${name}${shown(r.version)}`, r.line);
  }
  return flags;
}
