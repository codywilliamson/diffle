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

export type DependencyParser = (text: string) => DependencyEntry | null;

function entriesOf(lines: LineRef[], parse: DependencyParser): Map<string, LineRef & DependencyEntry> {
  const out = new Map<string, LineRef & DependencyEntry>();
  for (const ref of lines) {
    const entry = parse(ref.text);
    if (entry) out.set(entry.name, { ...ref, ...entry });
  }
  return out;
}

const shown = (version: string): string => (version ? ` ${version}` : "");

export function dependencyFlags(file: DiffFile, parse: DependencyParser): ChangeFlag[] {
  const added = entriesOf(addedLines(file), parse);
  const removed = entriesOf(deletedLines(file), parse);
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
