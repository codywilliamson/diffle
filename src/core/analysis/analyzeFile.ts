// per-file analysis: noise, effective size, test pairing, and the core's own flags on top of the adapter's.

import type { ChangeFlag, DiffFile, FileAnalysis, FileNoise, MovedBlock } from "../../types";
import { CHURN_WINDOW_DAYS } from "./churn";
import { editedKey } from "./movedEdits";
import { fileNoise } from "./noise";
import { adapterFor } from "./languages";
import type { Snapshot } from "./snapshot";
import { whitespaceOnlyHunks } from "./whitespace";

export const CODE_EXTENSIONS = new Set([
  ".cs", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".svelte", ".vue", ".py", ".go", ".rs",
  ".java", ".kt", ".rb", ".php", ".swift", ".cpp", ".c", ".h",
]);
export const HOTSPOT_COMMITS = 10;
export const LARGE_FILE_LINES = 300;
export const MAX_LEFTOVERS_PER_FILE = 5;

export interface FileContext {
  cwd: string;
  snapshot: Snapshot;
  generated: Set<string>; // linguist-generated paths
  churn: Record<string, number>;
  moved: MovedBlock[];
  editedMoved: Set<string>; // changed lines inside edited moved blocks, which stay effective
  pairs: Map<string, string>;
  changedSince: Set<string> | null; // null = no previous round
}

const extensionOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot).toLowerCase();
};

// changed-line keys covered by a moved block, per side, so overlaps with whitespace hunks count once
function movedKeys(moved: MovedBlock[], path: string): Set<string> {
  const keys = new Set<string>();
  for (const { from, to } of moved) {
    if (from.file === path) for (let n = from.start; n <= from.end; n++) keys.add(`-${n}`);
    if (to.file === path) for (let n = to.start; n <= to.end; n++) keys.add(`+${n}`);
  }
  return keys;
}

function countNoiseLines(file: DiffFile, wsHunks: number[], moved: MovedBlock[], editedMoved: Set<string>): number {
  const covered = movedKeys(moved, file.path);
  const lineKey = (l: DiffFile["hunks"][number]["lines"][number]): string =>
    l.type === "addition" ? `+${l.newLine}` : `-${l.oldLine}`;
  const isEdited = (l: DiffFile["hunks"][number]["lines"][number]): boolean =>
    editedMoved.has(editedKey(file.path, l.type === "addition" ? "+" : "-", (l.type === "addition" ? l.newLine : l.oldLine) ?? 0));
  let count = 0;
  file.hunks.forEach((hunk, index) => {
    const wholeHunk = wsHunks.includes(index);
    for (const l of hunk.lines) {
      if (l.type !== "context" && (wholeHunk || (covered.has(lineKey(l)) && !isEdited(l)))) count++;
    }
  });
  return count;
}

function capLeftovers(flags: ChangeFlag[]): ChangeFlag[] {
  const leftovers = flags.filter((f) => f.kind === "leftover");
  if (leftovers.length <= MAX_LEFTOVERS_PER_FILE) return flags;
  const hidden = leftovers.length - MAX_LEFTOVERS_PER_FILE;
  return [
    ...flags.filter((f) => f.kind !== "leftover"),
    ...leftovers.slice(0, MAX_LEFTOVERS_PER_FILE),
    { kind: "leftover", reason: `+${hidden} more leftovers in this file`, line: null },
  ];
}

function coreFlags(file: DiffFile, a: Pick<FileAnalysis, "effectiveLines" | "churn" | "testPair" | "isTest">): ChangeFlag[] {
  const flags: ChangeFlag[] = [];
  const touched = file.changeType === "added" || file.changeType === "modified";
  if (!a.isTest && touched && a.effectiveLines > 0 && !a.testPair && CODE_EXTENSIONS.has(extensionOf(file.path))) {
    flags.push({ kind: "untested", reason: "code change with no matching test in this diff", line: null });
  }
  if (a.churn >= HOTSPOT_COMMITS) {
    flags.push({ kind: "hotspot", reason: `${a.churn} commits in the last ${CHURN_WINDOW_DAYS} days`, line: null });
  }
  if (a.effectiveLines >= LARGE_FILE_LINES) {
    flags.push({ kind: "large", reason: `${a.effectiveLines} effective changed lines`, line: null });
  }
  return flags;
}

export function analyzeFile(file: DiffFile, ctx: FileContext): FileAnalysis {
  const adapter = adapterFor(file.path);
  const noise: FileNoise | null = adapter.noise(file.path) ?? fileNoise(file.path) ?? (ctx.generated.has(file.path) ? "generated" : null);
  const wsHunks = whitespaceOnlyHunks(file);
  const noiseLines = countNoiseLines(file, wsHunks, ctx.moved, ctx.editedMoved);
  const effectiveLines = noise ? 0 : Math.max(0, file.additions + file.deletions - noiseLines);
  const isTest = adapter.isTest(file.path);
  const testPair = ctx.pairs.get(file.path) ?? null;
  const churn = ctx.churn[file.path] ?? 0;
  const base = { effectiveLines, churn, testPair, isTest };
  const adapterFlags = adapter.flags(file);
  const flags = noise
    ? adapterFlags.filter((f) => f.kind === "dependency")
    : capLeftovers([...adapterFlags, ...coreFlags(file, base)]);
  return {
    path: file.path,
    language: adapter.id,
    group: adapter.groupOf(file.path, ctx.cwd, ctx.snapshot).label,
    noise,
    whitespaceOnlyHunks: wsHunks,
    noiseLines,
    effectiveLines,
    testPair,
    isTest,
    churn,
    changedSinceReview: ctx.changedSince ? ctx.changedSince.has(file.path) : null,
    flags,
  };
}
