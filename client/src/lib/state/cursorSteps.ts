// pure cursor motion over the flattened diff. no dom, no runes: the store feeds these the
// ordered files plus what each file body currently shows, and gets a new position back.
//
// stops are the lines a cursor can rest on. unified files expose every diff line (additions and
// context on the new side, deletions on the old side); split files expose one side at a time.
// files with nothing to rest on (binary, gated, collapsed, markdown preview) have no stops: line
// motions skip them, file jumps park the cursor at FILE_LEVEL (line 0) on them.
//
// flattening a big diff is the expensive part, so it lives in a StopIndex the caller builds once
// and reuses until the files, view modes or side preference change.

import type { DiffFile, DiffLine } from "$types";
import type { Side } from "$lib/diff/threads";
import { pairLines } from "$lib/diff/wordDiff";

export const FILE_LEVEL = 0;

export interface CursorPos {
  path: string;
  side: Side;
  line: number; // FILE_LEVEL when parked on a file with no lines to rest on
}

export interface FileView {
  file: DiffFile;
  split: boolean;
  navigable: boolean;
}

export interface Stop extends CursorPos {
  fileIndex: number;
  oldLine: number | null;
  newLine: number | null;
  content: string;
  hunkStart: boolean;
}

export interface StopIndex {
  stops: Stop[];
  fileStart: number[]; // stops of file i are stops[fileStart[i] .. fileStart[i + 1])
  fileOf: Map<string, number>;
  hunkStarts: number[]; // ascending stop indices that begin a hunk
}

export const samePos = (a: CursorPos | null, b: CursorPos | null): boolean =>
  a === b || (!!a && !!b && a.path === b.path && a.side === b.side && a.line === b.line);

function stopsOfView(view: FileView, fileIndex: number, pref: Side): Stop[] {
  if (!view.navigable) return [];
  const out: Stop[] = [];
  for (const hunk of view.file.hunks) {
    let hunkStart = true;
    for (const l of hunk.lines) {
      const side: Side = view.split ? pref : l.newLine != null ? "new" : "old";
      const line = side === "new" ? l.newLine : l.oldLine;
      if (line == null) continue;
      out.push({ path: view.file.path, fileIndex, side, line, oldLine: l.oldLine, newLine: l.newLine, content: l.content, hunkStart });
      hunkStart = false;
    }
  }
  return out;
}

export function buildIndex(views: FileView[], pref: Side): StopIndex {
  const stops: Stop[] = [];
  const fileStart: number[] = [];
  const fileOf = new Map<string, number>();
  const hunkStarts: number[] = [];
  views.forEach((view, i) => {
    fileStart.push(stops.length);
    fileOf.set(view.file.path, i);
    for (const s of stopsOfView(view, i, pref)) {
      if (s.hunkStart) hunkStarts.push(stops.length);
      stops.push(s);
    }
  });
  fileStart.push(stops.length);
  return { stops, fileStart, fileOf, hunkStarts };
}

const toPos = (s: Stop): CursorPos => ({ path: s.path, side: s.side, line: s.line });
const fileIndexOf = (index: StopIndex, path: string): number => index.fileOf.get(path) ?? -1;

function ownStops(index: StopIndex, path: string): Stop[] {
  const fi = fileIndexOf(index, path);
  return fi === -1 ? [] : index.stops.slice(index.fileStart[fi], index.fileStart[fi + 1]);
}

// where the cursor sits among the stops. integers are stops; a parked cursor is the half step
// just before the first stop of its file.
export function positionOf(index: StopIndex, pos: CursorPos): number {
  const fi = fileIndexOf(index, pos.path);
  const start = fi === -1 ? 0 : index.fileStart[fi]!;
  const end = fi === -1 ? 0 : index.fileStart[fi + 1]!;
  if (pos.line !== FILE_LEVEL && end > start) {
    let exact = -1;
    let loose = -1;
    let nearest = start;
    for (let i = start; i < end; i++) {
      const s = index.stops[i]!;
      if (s.side === pos.side && s.line === pos.line) {
        exact = i;
        break;
      }
      if (loose === -1 && (s.oldLine === pos.line || s.newLine === pos.line)) loose = i;
      if (Math.abs(s.line - pos.line) < Math.abs(index.stops[nearest]!.line - pos.line)) nearest = i;
    }
    return exact !== -1 ? exact : loose !== -1 ? loose : nearest;
  }
  return (fi === -1 ? index.stops.length : start) - 0.5;
}

export function moveLines(views: FileView[], pref: Side, pos: CursorPos, delta: number, index = buildIndex(views, pref)): CursorPos | null {
  const { stops } = index;
  if (stops.length === 0) return null;
  const p = positionOf(index, pos);
  const base = Number.isInteger(p) ? p : p + (delta > 0 ? -0.5 : 0.5);
  const target = Math.min(stops.length - 1, Math.max(0, base + delta));
  return toPos(stops[target]!);
}

function landOnFile(views: FileView[], index: StopIndex, fileIndex: number, pref: Side): CursorPos {
  const first = index.fileStart[fileIndex]! < index.fileStart[fileIndex + 1]! ? index.stops[index.fileStart[fileIndex]!] : undefined;
  return first ? toPos(first) : { path: views[fileIndex]!.file.path, side: pref, line: FILE_LEVEL };
}

export function moveFiles(views: FileView[], pref: Side, pos: CursorPos, delta: number, index = buildIndex(views, pref)): CursorPos | null {
  if (views.length === 0) return null;
  const from = Math.max(0, fileIndexOf(index, pos.path));
  const target = Math.min(views.length - 1, Math.max(0, from + delta));
  if (target === from) return pos;
  return landOnFile(views, index, target, pref);
}

// first element of an ascending array that is > value (or length).
function upperBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! > value) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function moveHunks(views: FileView[], pref: Side, pos: CursorPos, delta: number, index = buildIndex(views, pref)): CursorPos | null {
  const p = positionOf(index, pos);
  const { hunkStarts, stops } = index;
  const n = Math.abs(delta);
  let hop: number | undefined;
  if (delta > 0) {
    const first = upperBound(hunkStarts, p);
    hop = first < hunkStarts.length ? hunkStarts[Math.min(hunkStarts.length - 1, first + n - 1)] : undefined;
  } else {
    // starts strictly before p: those at index < lower, where lower = upperBound(p) minus an exact hit
    let lower = upperBound(hunkStarts, p);
    if (lower > 0 && hunkStarts[lower - 1]! >= p) lower--;
    hop = lower > 0 ? hunkStarts[Math.max(0, lower - n)] : undefined;
  }
  return hop === undefined ? null : toPos(stops[hop]!);
}

export function firstLine(views: FileView[], pref: Side, path: string, index = buildIndex(views, pref)): CursorPos | null {
  const fi = fileIndexOf(index, path);
  return fi === -1 ? null : landOnFile(views, index, fi, pref);
}

export function lastLine(views: FileView[], pref: Side, path: string, index = buildIndex(views, pref)): CursorPos | null {
  const own = ownStops(index, path);
  return own.length > 0 ? toPos(own[own.length - 1]!) : firstLine(views, pref, path, index);
}

// h / l in a split file: the other side's line in the same row, or the nearest row that has one.
export function switchSide(views: FileView[], pos: CursorPos, target: Side): CursorPos | null {
  const view = views.find((v) => v.file.path === pos.path);
  if (!view || !view.split || !view.navigable || pos.side === target || pos.line === FILE_LEVEL) return null;
  const rows = view.file.hunks.flatMap((h) => pairLines(h.lines));
  const numberOn = (row: (typeof rows)[number], side: Side): number | null =>
    (side === "old" ? row.left?.oldLine : row.right?.newLine) ?? null;
  const at = rows.findIndex((row) => numberOn(row, pos.side) === pos.line);
  if (at === -1) return null;
  for (let d = 0; d < rows.length; d++) {
    for (const i of d === 0 ? [at] : [at - d, at + d]) {
      const line = rows[i] ? numberOn(rows[i]!, target) : null;
      if (line != null) return { path: pos.path, side: target, line };
    }
  }
  return null;
}

// {count}G: the line whose NEW-side number is `number` (else the nearest), then the row it sits
// in on the active pane. a file that only deletes has no new numbers, so old ones stand in.
export function goToLineNumber(views: FileView[], pref: Side, path: string, number: number): CursorPos | null {
  const unified = views.map((v) => (v.file.path === path ? { ...v, split: false } : v));
  const own = ownStops(buildIndex(unified, pref), path);
  if (own.length === 0) return firstLine(views, pref, path);
  const withNew = own.filter((s) => s.newLine != null);
  const pool = withNew.length > 0 ? withNew.map((s) => ({ s, key: s.newLine! })) : own.map((s) => ({ s, key: s.line }));
  const best = pool.reduce((a, c) => (Math.abs(c.key - number) < Math.abs(a.key - number) ? c : a)).s;
  const found = toPos(best);
  const split = views.find((v) => v.file.path === path)?.split ?? false;
  if (!split) return found;
  if (best.newLine == null) return found;
  const onNew: CursorPos = { path, side: "new", line: best.newLine };
  return pref === "old" ? (switchSide(views, onNew, "old") ?? onNew) : onNew;
}

// after a refresh: the same line if it still exists, then the same text nearest the old spot,
// then the nearest line number. null when the file left the diff.
export function reanchor(views: FileView[], pref: Side, pos: CursorPos, content: string | null, index = buildIndex(views, pref)): CursorPos | null {
  const fi = fileIndexOf(index, pos.path);
  if (fi === -1) return null;
  if (pos.line === FILE_LEVEL) return landOnFile(views, index, fi, pref);
  const own = ownStops(index, pos.path);
  if (own.length === 0) return landOnFile(views, index, fi, pref);
  const keep = own.find((s) => s.side === pos.side && s.line === pos.line && (content === null || s.content === content));
  if (keep) return toPos(keep);
  const sameText = content?.trim() ? own.filter((s) => s.side === pos.side && s.content === content) : [];
  const pool = sameText.length > 0 ? sameText : own;
  return toPos(pool.reduce((a, c) => (Math.abs(c.line - pos.line) < Math.abs(a.line - pos.line) ? c : a)));
}

export function contentAt(views: FileView[], pref: Side, pos: CursorPos | null, index = buildIndex(views, pref)): string | null {
  if (!pos || pos.line === FILE_LEVEL) return null;
  const hit = ownStops(index, pos.path).find((s) => s.side === pos.side && s.line === pos.line);
  return hit?.content ?? null;
}

// does a rendered row carry the cursor? `pane` is set for one pane of a split file.
export function cursorOnLine(pos: CursorPos | null, line: DiffLine, pane?: Side): boolean {
  if (!pos || pos.line === FILE_LEVEL) return false;
  const side = pane ?? pos.side;
  if (pane && pane !== pos.side) return false;
  return (side === "new" ? line.newLine : line.oldLine) === pos.line;
}
