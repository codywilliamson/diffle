// c# change flags: public api, build/dependency changes, leftovers, sensitive paths.

import type { ChangeFlag, DiffFile } from "../../../types";
import { apiFlags, dependencyFlags, type DependencyParser } from "./declDiff";
import { parseCsharpDeclaration } from "./csharpApi";
import { isCsharpTest } from "./csharpPaths";
import { baseName, commonFlags, dirSegments, leftoverFlags, type LineRule } from "./flagHelpers";

const PACKAGE = /<(?:Package(?:Reference|Version)|GlobalPackageReference)\s[^>]*?\b(?:Include|Update)="([^"]+)"(?:[^>]*?\bVersion="([^"]*)")?/;
const TARGET = /<TargetFrameworks?>([^<]+)<\/TargetFrameworks?>/;
const SDK_VERSION = /"version"\s*:\s*"([^"]+)"/;
const NUGET_ENTRY = /<add\s+key="([^"]+)"\s+value="([^"]*)"/;

const parsePackages: DependencyParser = (text) => {
  const pkg = PACKAGE.exec(text);
  if (pkg) return { name: pkg[1]!, version: pkg[2] ?? "" };
  const target = TARGET.exec(text);
  return target ? { name: "TargetFramework", version: target[1]!.trim() } : null;
};

const parseSdk: DependencyParser = (text) => {
  const m = SDK_VERSION.exec(text);
  return m ? { name: "dotnet sdk", version: m[1]! } : null;
};

const parseNuget: DependencyParser = (text) => {
  const m = NUGET_ENTRY.exec(text);
  return m ? { name: `nuget ${m[1]}`, version: m[2]! } : null;
};

function dependencyParserFor(name: string): DependencyParser | null {
  const lower = name.toLowerCase();
  if (lower === "global.json") return parseSdk;
  if (lower === "nuget.config") return parseNuget;
  const isBuildFile = lower.endsWith(".csproj") || /^directory\.(packages|build)\.props$/.test(lower);
  return isBuildFile ? parsePackages : null;
}

const LEFTOVER_RULES: LineRule[] = [
  { re: /\bDebugger\.(Break|Launch)\(/, reason: "debugger call" },
  { re: /#pragma\s+warning\s+disable/, reason: "suppressed compiler warning", comment: true },
  { re: /\[\s*(Fact|Theory)\s*\(\s*Skip\b/, reason: "skipped test" },
  { re: /\[\s*Ignore\b|\[\s*Test\s*,\s*Ignore\b/, reason: "ignored test" },
  { re: /\basync\s+void\s+\w+\s*\((?!\s*object\s+\w*sender)/, reason: "async void method" },
  { re: /\.Result\b(?!\w)|\.Wait\(\s*\)|\.GetAwaiter\(\)\.GetResult\(\)/, reason: "blocking wait on a task" },
  { re: /\bnull!/, reason: "null-forgiving operator" },
];

const SENSITIVE_FILES = [/^program\.cs$/, /^startup\.cs$/, /^appsettings.*\.json$/, /\.csproj$/, /^directory\.build\.(props|targets)$/, /^web\.config$/];

export function csharpSensitiveReason(path: string): string | null {
  if (dirSegments(path).some((s) => s.toLowerCase() === "migrations")) return "ef migration";
  const name = baseName(path).toLowerCase();
  return SENSITIVE_FILES.some((re) => re.test(name)) ? `app startup or build config (${baseName(path)})` : null;
}

export function csharpFlags(file: DiffFile): ChangeFlag[] {
  const flags: ChangeFlag[] = [...commonFlags(file, csharpSensitiveReason)];
  const parseDep = dependencyParserFor(baseName(file.path));
  if (parseDep) flags.push(...dependencyFlags(file, parseDep));
  if (file.path.toLowerCase().endsWith(".cs") && !isCsharpTest(file.path)) {
    flags.push(...apiFlags(file, parseCsharpDeclaration));
  }
  flags.push(...leftoverFlags(file, LEFTOVER_RULES));
  return flags;
}
