// builds an all-context DiffResult from the repo's tracked files so nittle can browse and
// comment on the whole codebase. each file becomes one hunk of context lines (oldLine ===
// newLine), which the existing diff view, anchoring, and prompt compiler already handle.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DiffResult, DiffFile, DiffLine } from "../types";
import { runGit, repoName } from "../utils/git";

// tracked files under the optional scope path, in git's order. respects .gitignore.
// `ls-files` reads the index, so it still lists files deleted from the working tree —
// drop those, or reading them throws and takes the whole browse down.
function trackedFiles(cwd: string, scope: string | undefined): string[] {
  const list = (flags: string[]): string[] => {
    const args = ["ls-files", "-z", ...flags];
    if (scope) args.push("--", scope);
    return runGit(args, cwd).split("\0").filter(Boolean);
  };
  const deleted = new Set(list(["--deleted"]));
  return list([]).filter((path) => !deleted.has(path));
}

// one file's text as all-context lines numbered from 1; a single trailing empty line from
// a terminating newline is dropped so files don't render a phantom blank last row.
export function contextFile(path: string, text: string): DiffFile {
  const raw = text.split("\n");
  if (raw.length > 1 && raw[raw.length - 1] === "") raw.pop();
  const lines: DiffLine[] = raw.map((content, i): DiffLine => ({
    type: "context",
    oldLine: i + 1,
    newLine: i + 1,
    content,
  }));
  return { path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, hunks: [{ header: "", lines }] };
}

// a broken symlink, a permission error, or a file removed since the git listing shouldn't
// abort the scan — that file is simply left out.
function readOrNull(file: string) {
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}

// binary files (a NUL byte present) render like binary diff entries: flagged, no hunks.
function readFileAsDiff(cwd: string, path: string): DiffFile | null {
  const buf = readOrNull(join(cwd, path));
  if (!buf) return null;
  if (buf.includes(0)) {
    return { path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, binary: true, hunks: [] };
  }
  return contextFile(path, buf.toString("utf8"));
}

export function scanProject(cwd: string, scope?: string): DiffResult {
  const files = trackedFiles(cwd, scope)
    .map((p) => readFileAsDiff(cwd, p))
    .filter((f): f is DiffFile => f !== null);
  return {
    ref: "codebase",
    meta: { repo: repoName(cwd), mode: "browse", source: "codebase", target: "" },
    files,
  };
}
