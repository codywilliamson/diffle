// git shell helpers: run git, resolve a cli ref spec into a concrete diff plan, collect the diff.

import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import { REVIEW_FILE } from "../types";

// how to produce the diff plus the review context shown in the ui.
export interface DiffPlan {
  diffArgs: string[]; // args passed to `git`, e.g. ["diff", "HEAD"]
  refLabel: string; // shown in the top bar, e.g. "working tree" or "feature/x → origin/main"
  newRef: string | null; // ref for the "new" side content; null = working tree (read from disk)
  mode: string; // "working tree" | "staged" | "branch" | "range"
  source: string; // the "new" side label
  target: string; // the "base" side label
  includeUntracked: boolean; // working-tree mode also surfaces untracked files
}

// runs `git <args>` in cwd and returns raw stdout bytes. throws with stderr on failure.
export function runGitBytes(args: string[], cwd: string): Buffer {
  const proc = Bun.spawnSync(["git", ...args], { cwd });
  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  }
  return proc.stdout;
}

// runs `git <args>` in cwd and returns stdout as text.
export function runGit(args: string[], cwd: string): string {
  return runGitBytes(args, cwd).toString();
}

// "owner/repo" from the origin remote, falling back to the working-dir folder name.
export function repoName(cwd: string): string {
  try {
    const url = runGit(["remote", "get-url", "origin"], cwd).trim();
    const m = /[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
    if (m && m[1]) return m[1];
  } catch {
    // no origin remote configured
  }
  return basename(cwd) || cwd;
}

// true when git's standard exclude rules (.gitignore, .git/info/exclude, …) hide `path`.
export function isIgnored(path: string, cwd: string): boolean {
  return Bun.spawnSync(["git", "check-ignore", "-q", "--", path], { cwd }).exitCode === 0;
}

// git's own path to the per-clone exclude file, relative to cwd. null outside a repo.
// `rev-parse --git-path` gets this right for worktrees and submodules, where .git is a file.
export function gitExcludePath(cwd: string): string | null {
  try {
    return runGit(["rev-parse", "--git-path", "info/exclude"], cwd).trim() || null;
  } catch {
    return null;
  }
}

// `git diff --no-index` exits 1 whenever the files differ (always true for a new file),
// so it can't go through runGit (which throws on non-zero). we just want its stdout.
function untrackedDiff(path: string, cwd: string): string {
  const proc = Bun.spawnSync(["git", "diff", "--no-index", "--", "/dev/null", path], { cwd });
  return proc.stdout.toString();
}

// loupe excludes .review from git, so `--exclude-standard` drops it from the untracked listing.
// when the user opts into reviewing it we add it back — unless it is tracked, in which case the
// plain diff already covers it and a synthetic entry would duplicate the file.
function untrackedReviewFile(cwd: string): string[] {
  if (!existsSync(join(cwd, REVIEW_FILE))) return [];
  return runGit(["ls-files", "--", REVIEW_FILE], cwd).trim() ? [] : [REVIEW_FILE];
}

// runs the planned diff; in working-tree mode also appends synthetic "new file" diffs for
// untracked files (which `git diff` omits by design) so they show up and are commentable.
export function collectDiff(diffArgs: string[], cwd: string, includeUntracked: boolean, showReview = false): string {
  let raw = runGit(diffArgs, cwd);
  if (!includeUntracked) return raw;
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"], cwd)
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p !== REVIEW_FILE); // handled below, so the setting decides in one place
  if (showReview) untracked.push(...untrackedReviewFile(cwd));
  if (untracked.length && raw && !raw.endsWith("\n")) raw += "\n";
  for (const path of untracked) raw += untrackedDiff(path, cwd);
  return raw;
}

function isGitRepo(cwd: string): boolean {
  const proc = Bun.spawnSync(["git", "rev-parse", "--is-inside-work-tree"], { cwd });
  return proc.exitCode === 0;
}

function refExists(ref: string, cwd: string): boolean {
  return Bun.spawnSync(["git", "rev-parse", "--verify", "--quiet", ref], { cwd }).exitCode === 0;
}

// Prefer the ref exactly as typed. If it is not available locally, accept the
// corresponding origin ref so `loupe feature/x` works after a fetch without
// requiring the more verbose `loupe origin/feature/x`.
function resolveAvailableRef(ref: string, cwd: string): string | null {
  if (refExists(ref, cwd)) return ref;
  const originRef = `origin/${ref}`;
  return ref.startsWith("origin/") || !refExists(originRef, cwd) ? null : originRef;
}

function currentBranch(cwd: string): string {
  return runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd).trim();
}

// maps the optional cli arg into a diff plan, validating refs against the local repo.
// throws a clear message the cli can print before exiting.
export function resolveRef(spec: string | undefined, cwd: string): DiffPlan {
  if (!isGitRepo(cwd)) throw new Error("not a git repository (run loupe inside one)");

  if (!spec || spec === "HEAD") {
    const target = currentBranch(cwd);
    return { diffArgs: ["diff", "HEAD"], refLabel: "working tree", newRef: null, mode: "working tree", source: "working tree", target, includeUntracked: true };
  }
  if (spec === "staged") {
    const target = currentBranch(cwd);
    return { diffArgs: ["diff", "--staged"], refLabel: "staged", newRef: "", mode: "staged", source: "staged", target, includeUntracked: false };
  }

  const parts = spec.split("..");
  if (parts.length === 2) {
    const [from, to] = parts as [string, string];
    let resolvedFrom = "";
    let resolvedTo = "";
    if (from) {
      const resolved = resolveAvailableRef(from, cwd);
      if (!resolved) throw new Error(`unknown ref: ${from}`);
      resolvedFrom = resolved;
    }
    if (to) {
      const resolved = resolveAvailableRef(to, cwd);
      if (!resolved) throw new Error(`unknown ref: ${to}`);
      resolvedTo = resolved;
    }
    const range = `${resolvedFrom}..${resolvedTo}`;
    return { diffArgs: ["diff", range], refLabel: `${resolvedFrom} → ${resolvedTo}`, newRef: resolvedTo || "HEAD", mode: "range", source: resolvedFrom, target: resolvedTo, includeUntracked: false };
  }

  // a single named branch: show what the current branch added relative to it (pr-style three-dot)
  const target = resolveAvailableRef(spec, cwd);
  if (!target) throw new Error(`unknown ref: ${spec}`);
  const branch = currentBranch(cwd);
  return { diffArgs: ["diff", `${target}...HEAD`], refLabel: `${branch} → ${target}`, newRef: "HEAD", mode: "branch", source: branch, target, includeUntracked: false };
}
