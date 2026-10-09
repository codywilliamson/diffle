// ts/js change flags: exported api, package.json dependencies, leftovers, generic sensitive paths.

import type { ChangeFlag, DiffFile } from "../../../types";
import { apiFlags, dependencyFlags, type DependencyParser, type DeclParser } from "./declDiff";
import { baseName, commonFlags, leftoverFlags, type LineRule } from "./flagHelpers";
import { isTypescriptTest } from "./typescriptPaths";

const EXPORT_DEFAULT = /^export\s+default\b/;
const EXPORT_DECL = /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(function\*?|class|const|let|var|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/;
const FUNCTION_SIGNATURE = /function\*?\s+([\w$]+\s*(?:<.*>)?\s*\([^)]*\))/;
const DEPENDENCY_ENTRY = /^\s*"([^"]+)"\s*:\s*"([^"]+)",?\s*$/;
const VERSION_SPEC = /^[\^~<>=*\d]|^(workspace|npm|file|link|git|github):|^latest$/;
const NOT_DEPENDENCY_KEYS = new Set(["version", "name", "main", "module", "types", "license", "packageManager"]);

// declaration up to the body (params and return type), so editing a one-line body keeps its identity
const signatureOf = (t: string, found: RegExpExecArray | null): string => {
  if (!found) return t;
  const headEnd = found.index + found[0].length;
  return t.slice(0, headEnd) + t.slice(headEnd).split("{")[0]!.trimEnd();
};

export const parseTypescriptExport: DeclParser = (raw) => {
  const t = raw.trim().replace(/\s+/g, " ").replace(/\s*\{$/, "");
  if (EXPORT_DEFAULT.test(t)) return { key: t, label: "exported default" };
  const m = EXPORT_DECL.exec(t);
  if (!m) return null;
  const [, kind, name] = m as unknown as [string, string, string];
  if (kind.startsWith("function")) {
    const found = FUNCTION_SIGNATURE.exec(t);
    const sig = found?.[1] ?? name;
    return { key: signatureOf(t, found), label: `exported function \`${sig}\`` };
  }
  return { key: `${kind} ${name}`, label: `exported ${kind} \`${name}\`` };
};

export const parsePackageJsonDependency: DependencyParser = (text) => {
  const m = DEPENDENCY_ENTRY.exec(text);
  if (!m || NOT_DEPENDENCY_KEYS.has(m[1]!) || !VERSION_SPEC.test(m[2]!)) return null;
  return { name: m[1]!, version: m[2]! };
};

const LEFTOVER_RULES: LineRule[] = [
  { re: /\bconsole\.log\(/, reason: "console.log" },
  { re: /^\s*debugger\b/, reason: "debugger statement" },
  { re: /\.only\(/, reason: "focused test" },
  { re: /\b(it|describe|test)\.skip\b/, reason: "skipped test" },
  { re: /@ts-ignore/, reason: "type check suppressed", comment: true },
  { re: /@ts-expect-error/, reason: "type error expected", comment: true },
  { re: /eslint-disable/, reason: "lint suppressed", comment: true },
  { re: /\bas any\b/, reason: "`as any` cast" },
];

export function typescriptFlags(file: DiffFile): ChangeFlag[] {
  const flags = [...commonFlags(file)];
  if (baseName(file.path) === "package.json") flags.push(...dependencyFlags(file, () => parsePackageJsonDependency));
  else if (!isTypescriptTest(file.path)) flags.push(...apiFlags(file, parseTypescriptExport));
  flags.push(...leftoverFlags(file, LEFTOVER_RULES));
  return flags;
}
