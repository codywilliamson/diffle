// git plumbing for blob-level snapshots: hash/look up the new-side content of many paths in one call each.

import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runGit } from "./git";

export type BlobMap = Record<string, string | null>;

function runGitWithInputBytes(args: string[], cwd: string, input: string): Buffer {
  const proc = Bun.spawnSync(["git", ...args], { cwd, stdin: Buffer.from(input) });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  return proc.stdout;
}

const runGitWithInput = (args: string[], cwd: string, input: string): string => runGitWithInputBytes(args, cwd, input).toString();

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

const NEWLINE = 0x0a;
const BATCH_HEADER = /^[0-9a-f]+ (\w+) (\d+)$/; // `<sha> <type> <size>`; a missing object has no content

// lines in a text, as the client splits it: a trailing newline adds no empty line.
export function countLines(bytes: Uint8Array): number {
  let lines = 0;
  for (const byte of bytes) if (byte === NEWLINE) lines++;
  return bytes.length > 0 && bytes[bytes.length - 1] !== NEWLINE ? lines + 1 : lines;
}

// new-side line count per path (null = missing, symlink, or not a blob). a ref reads every path in
// one cat-file --batch call; null ref reads the working tree.
export function newSideLineCounts(cwd: string, newRef: string | null, paths: string[]): Record<string, number | null> {
  const counts: Record<string, number | null> = Object.fromEntries(paths.map((path) => [path, null]));
  if (newRef === null) {
    for (const path of paths) if (isFile(cwd, path)) counts[path] = countLines(readFileSync(join(cwd, path)));
    return counts;
  }
  if (!paths.length) return counts;
  const out = runGitWithInputBytes(["cat-file", "--batch"], cwd, `${paths.map((path) => `${newRef}:${path}`).join("\n")}\n`);
  let at = 0;
  for (const path of paths) {
    const eol = out.indexOf(NEWLINE, at);
    if (eol < 0) break;
    const header = BATCH_HEADER.exec(out.subarray(at, eol).toString());
    at = eol + 1;
    if (!header) continue;
    const size = Number(header[2]);
    if (header[1] === "blob") counts[path] = countLines(out.subarray(at, at + size));
    at += size + 1;
  }
  return counts;
}
