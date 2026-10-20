// where a navigation result goes. one rule for definitions, references and symbols: a line the
// diff shows moves the cursor there (a recorded jump, so Ctrl+o returns); anything else, an
// unchanged repo file, a changed file's untouched part or a path outside the repo, opens in the
// read-only viewer.

import type { DiffFile, LspLocation, LspRange, LspSide, SearchHit } from "$types";

export interface JumpTarget {
  path: string | null; // repo-relative, null outside the repo
  absolutePath: string;
  uri?: string; // present when the server handed the location out; document symbols have none
  inRepo: boolean;
  side?: LspSide; // "old" when path and line are the base commit's; absent for the new side
  line: number; // 1-based
  character: number; // utf-16
}

export interface JumpDeps {
  files: () => DiffFile[];
  toDiff: (hit: SearchHit) => void;
  toViewer: (target: JumpTarget) => void;
}

export function targetOf(location: Pick<LspLocation, "path" | "absolutePath" | "inRepo" | "side"> & { uri?: string }, range: LspRange): JumpTarget {
  return {
    path: location.path,
    absolutePath: location.absolutePath,
    ...(location.uri ? { uri: location.uri } : {}),
    inRepo: location.inRepo,
    ...(location.side === "old" ? { side: "old" as const } : {}),
    line: range.start.line,
    character: range.start.character,
  };
}

// the diff draws this line on the new side, so the cursor can rest on it
export function diffShowsLine(file: DiffFile | undefined, line: number): file is DiffFile {
  if (!file || file.binary) return false;
  return file.hunks.some((hunk) => hunk.lines.some((l) => l.newLine === line));
}

// the diff draws this line of the base file, as a removed or a context line
export function diffShowsOldLine(file: DiffFile | undefined, line: number): file is DiffFile {
  if (!file || file.binary) return false;
  return file.hunks.some((hunk) => hunk.lines.some((l) => l.oldLine === line));
}

export function jumpTo(deps: JumpDeps, target: JumpTarget): "diff" | "viewer" {
  // an old-side answer speaks the base commit's path and line numbers, never the new side's
  if (target.side === "old") {
    const old = target.path ? deps.files().find((f) => (f.oldPath ?? f.path) === target.path) : undefined;
    if (diffShowsOldLine(old, target.line)) {
      deps.toDiff({ path: target.path!, side: "old", line: target.line, preview: "", ranges: [] });
      return "diff";
    }
    deps.toViewer(target);
    return "viewer";
  }
  const file = target.path ? deps.files().find((f) => f.path === target.path) : undefined;
  if (diffShowsLine(file, target.line)) {
    deps.toDiff({ path: file.path, side: "new", line: target.line, preview: "", ranges: [] });
    return "diff";
  }
  deps.toViewer(target);
  return "viewer";
}
