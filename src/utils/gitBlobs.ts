// git plumbing for blob-level snapshots: hash/look up the new-side content of many paths in one call each.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { runGit } from "./git";

export type BlobMap = Record<string, string | null>;

function runGitWithInput(args: string[], cwd: string, input: string): string {
  const proc = Bun.spawnSync(["git", ...args], { cwd, stdin: Buffer.from(input) });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  return proc.stdout.toString();
}

const emptyMap = (paths: string[]): BlobMap => Object.fromEntries(paths.map((path) => [path, null]));

// lstat, so a symlink never counts as a file (its target could sit outside the repo)
const isFile = (cwd: string, path: string) => {
  try {
    return lstatSync(join(cwd, path)).isFile();
  } catch {
    return false;
  }
};

// working tree: returns each file's blob sha; missing or symlink -> null. `write` stores the objects so
// they can be diffed later, comparisons alone never touch the object db.
export function workingTreeBlobs(cwd: string, paths: string[], write = false): BlobMap {
  const present = paths.filter((path) => isFile(cwd, path));
  const blobs = emptyMap(paths);
  if (!present.length) return blobs;
  const shas = runGitWithInput(["hash-object", ...(write ? ["-w"] : []), "--stdin-paths"], cwd, `${present.join("\n")}\n`).split("\n").filter(Boolean);
  present.forEach((path, i) => { blobs[path] = shas[i] ?? null; });
  return blobs;
}

// staged: index entries, `<mode> <sha> <stage>\t<path>`
export function stagedBlobs(cwd: string, paths: string[]): BlobMap {
  const blobs = emptyMap(paths);
  if (!paths.length) return blobs;
  for (const entry of runGit(["ls-files", "-s", "-z", "--", ...paths], cwd).split("\0").filter(Boolean)) {
    const tab = entry.indexOf("\t");
    const sha = entry.slice(0, tab).split(" ")[1];
    if (sha) blobs[entry.slice(tab + 1)] = sha;
  }
  return blobs;
}

// committed ref: one cat-file --batch-check call, `<sha> blob <size>` or `<spec> missing`
export function refBlobs(cwd: string, ref: string, paths: string[]): BlobMap {
  const blobs = emptyMap(paths);
  if (!paths.length) return blobs;
  const input = `${paths.map((path) => `${ref}:${path}`).join("\n")}\n`;
  const lines = runGitWithInput(["cat-file", "--batch-check"], cwd, input).split("\n");
  paths.forEach((path, i) => {
    const [sha, type] = (lines[i] ?? "").split(" ");
    if (type === "blob" && sha) blobs[path] = sha;
  });
  return blobs;
}

const emptyBlob = (cwd: string) => runGitWithInput(["hash-object", "-w", "--stdin"], cwd, "").trim();

// raw unified diff between two blobs; null on either side means "no content" (added / deleted)
export function diffBlobs(cwd: string, oldSha: string | null, newSha: string | null): string {
  const empty = oldSha && newSha ? "" : emptyBlob(cwd);
  return runGit(["diff", "--no-color", "--no-ext-diff", oldSha ?? empty, newSha ?? empty], cwd);
}
