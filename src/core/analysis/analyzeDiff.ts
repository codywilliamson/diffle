// the deterministic review scorecard for a diff: per-file analysis, review order, and risk categories.

import type { DiffFile, DiffMeta, DiffResult, MovedBlock, ReviewRound, ReviewScorecard } from "../../types";
import { changedSinceRound } from "../reviewRounds";
import { analyzeFile } from "./analyzeFile";
import { fileChurn } from "./churn";
import { detectMovedBlocks } from "./moved";
import { editedMovedLines } from "./movedEdits";
import { dropMovedApiFlags } from "./movedApi";
import { linguistGenerated } from "./noise";
import { whitespaceOnlyHunks } from "./whitespace";
import { createSnapshot } from "./snapshot";
import { orderReview } from "./reviewOrder";
import { buildCategories } from "./scorecardBands";
import { pairTests } from "./testPairs";

export interface AnalyzeOptions {
  cwd: string;
  newRef: string | null;
  churnBase: string | null; // ref to count churn up to; null = HEAD
  round?: ReviewRound | undefined;
}

// branch and range diffs exclude the change under review from churn by counting up to the base ref
export function churnBaseFor(meta: DiffMeta | undefined): string | null {
  if (meta?.mode === "branch") return meta.target;
  if (meta?.mode === "range") return meta.source;
  return null;
}

interface WhitespaceFile {
  file: DiffFile;
  wsHunks: number[];
}

// a reindent shows up as a "move" onto itself; the whitespace-only hunk already covers it
function isReindent(block: MovedBlock, byPath: Map<string, WhitespaceFile>): boolean {
  if (block.from.file !== block.to.file) return false;
  const entry = byPath.get(block.from.file);
  if (!entry) return false;
  const { file, wsHunks } = entry;
  return wsHunks.some((i) => {
    const lines = file.hunks[i]!.lines;
    const has = (side: "oldLine" | "newLine", n: number) => lines.some((l) => l[side] === n);
    return has("oldLine", block.from.start) && has("oldLine", block.from.end) && has("newLine", block.to.start) && has("newLine", block.to.end);
  });
}

// a renamed file's history lives under its old path; count that and attribute it to the new path
function renamedChurn(files: DiffFile[], cwd: string, base: string | null): Record<string, number> {
  const counts = fileChurn(files.map((f) => f.oldPath ?? f.path), cwd, base);
  return Object.fromEntries(files.map((f) => [f.path, counts[f.oldPath ?? f.path] ?? 0]));
}

export function analyzeDiff(diff: DiffResult, opts: AnalyzeOptions): ReviewScorecard {
  const paths = diff.files.map((f) => f.path);
  const byPath = new Map(diff.files.map((file) => [file.path, { file, wsHunks: whitespaceOnlyHunks(file) }]));
  const moved = detectMovedBlocks(diff.files).filter((b) => !isReindent(b, byPath));
  const snapshot = createSnapshot(opts.cwd, opts.newRef);
  const ctx = {
    cwd: opts.cwd,
    snapshot,
    generated: linguistGenerated(paths, opts.cwd, opts.newRef),
    churn: renamedChurn(diff.files, opts.cwd, opts.churnBase),
    moved,
    editedMoved: editedMovedLines(diff.files, moved),
    pairs: pairTests(diff.files),
    changedSince: opts.round ? changedSinceRound(opts.round, opts.cwd, opts.newRef, paths) : null,
  };
  const { groups, ordered } = orderReview(dropMovedApiFlags(diff.files.map((f) => analyzeFile(f, ctx)), moved), opts.cwd, snapshot);
  const additions = diff.files.reduce((n, f) => n + f.additions, 0);
  const deletions = diff.files.reduce((n, f) => n + f.deletions, 0);
  const effectiveLines = ordered.reduce((n, f) => n + f.effectiveLines, 0);
  // noiseLines covers whole noise files too, so additions + deletions = effective + noise
  const totals = { files: ordered.length, additions, deletions, effectiveLines, noiseLines: additions + deletions - effectiveLines };
  return { totals, categories: buildCategories(ordered, totals), groups, files: ordered, moved };
}
