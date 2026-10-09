// language-agnostic whole-file noise: lockfiles and generated artifacts the ui collapses by default.

import type { FileNoise } from "../../types";

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "deno.lock",
  "cargo.lock",
  "poetry.lock",
  "pdm.lock",
  "pipfile.lock",
  "uv.lock",
  "go.sum",
  "composer.lock",
  "gemfile.lock",
  "podfile.lock",
  "packages.lock.json",
  "paket.lock",
  "pubspec.lock",
  "mix.lock",
  "flake.lock",
  "gradle.lockfile",
  ".terraform.lock.hcl",
]);

const GENERATED_SUFFIXES = [".min.js", ".min.css", ".map", ".snap"];
const GENERATED_DIRS = ["__snapshots__"];
const LINGUIST_ATTR = "linguist-generated";
const LINGUIST_SET_VALUES = new Set(["set", "true"]);

// null when the path is ordinary source.
export function fileNoise(path: string): FileNoise | null {
  const segments = path.replace(/\\/g, "/").toLowerCase().split("/");
  const name = segments[segments.length - 1] ?? "";
  if (LOCKFILE_NAMES.has(name)) return "lockfile";
  if (GENERATED_SUFFIXES.some((suffix) => name.endsWith(suffix))) return "generated";
  if (segments.slice(0, -1).some((dir) => GENERATED_DIRS.includes(dir))) return "generated";
  return null;
}

// paths marked `linguist-generated` in .gitattributes, via one git call. any failure -> empty set.
export function linguistGenerated(paths: string[], cwd: string): Set<string> {
  const generated = new Set<string>();
  if (!paths.length) return generated;
  try {
    const proc = Bun.spawnSync(["git", "check-attr", "-z", "--stdin", LINGUIST_ATTR], {
      cwd,
      stdin: Buffer.from(paths.join("\0") + "\0"),
    });
    if (proc.exitCode !== 0) return generated;
    const fields = proc.stdout.toString().split("\0");
    // output is repeating (path, attr, value) triples
    for (let i = 0; i + 2 < fields.length; i += 3) {
      if (LINGUIST_SET_VALUES.has(fields[i + 2] ?? "")) generated.add(fields[i] ?? "");
    }
  } catch {
    // git missing or not a repo
  }
  return generated;
}
