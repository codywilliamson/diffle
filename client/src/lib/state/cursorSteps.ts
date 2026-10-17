// pure cursor motion over the flattened diff. no dom, no runes: the store feeds these the
// ordered files plus what each file body currently shows, and gets a new position back.
//
// stops are the lines a cursor can rest on. unified files expose every diff line (additions and
// context on the new side, deletions on the old side); split files expose one side at a time.
// files with nothing to rest on (binary, gated, collapsed, markdown preview) have no stops: line
// motions skip them, file jumps park the cursor at FILE_LEVEL (line 0) on them.

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

export function flatten(views: FileView[], pref: Side): Stop[] {
  return views.flatMap((view, i) => stopsOfView(view, i, pref));
}

const fileIndexOf = (views: FileView[], path: string): number => views.findIndex((v) => v.file.path === path);
const toPos = (s: Stop): CursorPos => ({ path: s.path, side: s.side, line: s.line });

// where the cursor sits among the stops. integers are stops; a parked cursor is the half step
// just before the first stop of its file.
export function positionOf(stops: Stop[], views: FileView[], pos: CursorPos): number {
  const fi = fileIndexOf(views, pos.path);
  if (pos.line !== FILE_LEVEL) {
    const own = stops.map((s, i) => ({ s, i })).filter(({ s }) => s.fileIndex === fi);
    const exact = own.find(({ s }) => s.side === pos.side && s.line === pos.line) ?? own.find(({ s }) => s.oldLine === pos.line || s.newLine === pos.line);
    if (exact) return exact.i;
    if (own.length > 0) {
      return own.reduce((best, cur) => (Math.abs(cur.s.line - pos.line) < Math.abs(best.s.line - pos.line) ? cur : best)).i;
    }
  }
  const next = stops.findIndex((s) => s.fileIndex >= fi);
  return (next === -1 ? stops.length : next) - 0.5;
}

export function moveLines(views: FileView[], pref: Side, pos: CursorPos, delta: number): CursorPos | null {
  const stops = flatten(views, pref);
  if (stops.length === 0) return null;
  const p = positionOf(stops, views, pos);
  const base = Number.isInteger(p) ? p : p + (delta > 0 ? -0.5 : 0.5);
  const target = Math.min(stops.length - 1, Math.max(0, base + delta));
  return toPos(stops[target]!);
}

function landOnFile(views: FileView[], stops: Stop[], fileIndex: number, pref: Side): CursorPos {
  const first = stops.find((s) => s.fileIndex === fileIndex);
  return first ? toPos(first) : { path: views[fileIndex]!.file.path, side: pref, line: FILE_LEVEL };
}

export function moveFiles(views: FileView[], pref: Side, pos: CursorPos, delta: number): CursorPos | null {
  if (views.length === 0) return null;
  const from = Math.max(0, fileIndexOf(views, pos.path));
  const target = Math.min(views.length - 1, Math.max(0, from + delta));
  if (target === from) return pos;
  return landOnFile(views, flatten(views, pref), target, pref);
}

export function moveHunks(views: FileView[], pref: Side, pos: CursorPos, delta: number): CursorPos | null {
  const stops = flatten(views, pref);
  const p = positionOf(stops, views, pos);
  const starts = stops.map((s, i) => (s.hunkStart ? i : -1)).filter((i) => i >= 0);
  const reachable = delta > 0 ? starts.filter((i) => i > p) : starts.filter((i) => i < p).reverse();
  const hop = reachable[Math.min(Math.abs(delta), reachable.length) - 1];
  return hop === undefined ? null : toPos(stops[hop]!);
}

function fileStops(views: FileView[], pref: Side, path: string): Stop[] {
  return flatten(views, pref).filter((s) => s.path === path);
}

export function firstLine(views: FileView[], pref: Side, path: string): CursorPos | null {
  const fi = fileIndexOf(views, path);
  return fi === -1 ? null : landOnFile(views, flatten(views, pref), fi, pref);
}

export function lastLine(views: FileView[], pref: Side, path: string): CursorPos | null {
  const own = fileStops(views, pref, path);
  return own.length > 0 ? toPos(own[own.length - 1]!) : firstLine(views, pref, path);
}

// {count}G: the stop whose new-side line number is `number`, else the nearest existing one.
// split files on the old side count in old-side numbers, matching what that pane shows.
export function goToLineNumber(views: FileView[], pref: Side, path: string, number: number): CursorPos | null {
  const own = fileStops(views, pref, path);
  const split = views[fileIndexOf(views, path)]?.split ?? false;
  const oldNumbers = split && pref === "old";
  const keyed = own.map((s) => ({ s, key: oldNumbers ? s.oldLine : s.newLine })).filter((e): e is { s: Stop; key: number } => e.key != null);
  const pool = keyed.length > 0 ? keyed : own.map((s) => ({ s, key: s.line }));
  if (pool.length === 0) return firstLine(views, pref, path);
  const best = pool.reduce((a, c) => (Math.abs(c.key - number) < Math.abs(a.key - number) ? c : a));
  return toPos(best.s);
}

// h / l in a split file: the other side's line in the same row, or the nearest row that has one.
export function switchSide(views: FileView[], pos: CursorPos, target: Side): CursorPos | null {
  const view = views[fileIndexOf(views, pos.path)];
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

// after a refresh: the same line if it still exists, then the same text nearest the old spot,
// then the nearest line number. null when the file left the diff.
export function reanchor(views: FileView[], pref: Side, pos: CursorPos, content: string | null): CursorPos | null {
  const fi = fileIndexOf(views, pos.path);
  if (fi === -1) return null;
  if (pos.line === FILE_LEVEL) return landOnFile(views, flatten(views, pref), fi, pref);
  const own = fileStops(views, pref, pos.path);
  if (own.length === 0) return landOnFile(views, flatten(views, pref), fi, pref);
  const keep = own.find((s) => s.side === pos.side && s.line === pos.line && (content === null || s.content === content));
  if (keep) return toPos(keep);
  const sameText = content?.trim() ? own.filter((s) => s.side === pos.side && s.content === content) : [];
  const pool = sameText.length > 0 ? sameText : own;
  return toPos(pool.reduce((a, c) => (Math.abs(c.line - pos.line) < Math.abs(a.line - pos.line) ? c : a)));
}

export function contentAt(views: FileView[], pref: Side, pos: CursorPos | null): string | null {
  if (!pos || pos.line === FILE_LEVEL) return null;
  const hit = fileStops(views, pref, pos.path).find((s) => s.side === pos.side && s.line === pos.line);
  return hit?.content ?? null;
}

// does a rendered row carry the cursor? `pane` is set for one pane of a split file.
export function cursorOnLine(pos: CursorPos | null, line: DiffLine, pane?: Side): boolean {
  if (!pos || pos.line === FILE_LEVEL) return false;
  const side = pane ?? pos.side;
  if (pane && pane !== pos.side) return false;
  return (side === "new" ? line.newLine : line.oldLine) === pos.line;
}
