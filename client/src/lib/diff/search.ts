// in-file search over a diff: a pure match finder, no dom. the matching rules mirror the server's
// (src/core/search.ts): smart case (insensitive unless the query has an uppercase letter), ranges
// are [start, end) utf-16 offsets into the line, lines are cut at MAX_SCAN_LINE_CHARS before
// matching, and a line yields at most MAX_RANGES_PER_LINE ranges. matches never overlap ("aa" in
// "aaa" is one match), like every regex scan.

import type { DiffFile } from "$types";
import type { Side } from "$lib/diff/threads";
import { markRange } from "./wordDiff";

export const MAX_SCAN_LINE_CHARS = 5_000;
export const MAX_RANGES_PER_LINE = 50;
export const MAX_FILE_MATCHES = 5_000;
export const MATCH_CLASS = "sm";
export const ACTIVE_MATCH_CLASS = "sm sm-active";

export interface LineRange {
  start: number;
  end: number;
}

// a match in document order. `order` is the flat index of its diff line within the file.
export interface FileMatch extends LineRange {
  index: number;
  order: number;
  oldLine: number | null;
  newLine: number | null;
}

// what a rendered line needs to know about the matches on it.
export interface LineHit extends LineRange {
  index: number;
}

const escapeLiteral = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasUppercase = (query: string): boolean => /\p{Lu}/u.test(query);

export function compileQuery(query: string): RegExp | null {
  if (query === "") return null;
  return new RegExp(escapeLiteral(query), hasUppercase(query) ? "gu" : "giu");
}

const splitsPair = (text: string, index: number): boolean => {
  const code = text.charCodeAt(index);
  return code >= 0xdc00 && code <= 0xdfff;
};

// the part of a line that is scanned: no trailing \r, and cut (never inside an emoji) when huge.
function scanned(text: string): { full: string; line: string; at: number } {
  const full = text.endsWith("\r") ? text.slice(0, -1) : text;
  if (full.length <= MAX_SCAN_LINE_CHARS) return { full, line: full, at: full.length };
  const at = splitsPair(full, MAX_SCAN_LINE_CHARS) ? MAX_SCAN_LINE_CHARS - 1 : MAX_SCAN_LINE_CHARS;
  return { full, line: full.slice(0, at), at };
}

// does an occurrence reach past the scan cut? the tail is read with a (queryLength - 1) overlap so
// one straddling the cut counts; one that ends inside the scanned part was already found.
function hiddenPastCut(regex: RegExp, full: string, at: number, queryLength: number): boolean {
  if (at >= full.length) return false;
  const from = Math.max(0, at - (queryLength - 1));
  const tail = full.slice(from);
  regex.lastIndex = 0;
  for (let m = regex.exec(tail); m; m = regex.exec(tail)) {
    if (m.index + m[0].length > at - from) return true;
  }
  return false;
}

// why a result is incomplete: a cap cut matches off, or a long line hid some past the scan limit.
export type Truncation = "capped" | "cut";

export interface LineScan {
  ranges: LineRange[];
  capped: boolean; // more matches on the line than MAX_RANGES_PER_LINE
  cut: boolean; // the unscanned tail of a long line holds another occurrence
}

export function rangesInLine(regex: RegExp, text: string, queryLength = 1): LineScan {
  const { full, line, at } = scanned(text);
  const ranges: LineRange[] = [];
  regex.lastIndex = 0;
  let m = regex.exec(line);
  for (; m && ranges.length < MAX_RANGES_PER_LINE; m = regex.exec(line)) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return { ranges, capped: m !== null, cut: hiddenPastCut(regex, full, at, queryLength) };
}

export interface FileSearch {
  matches: FileMatch[];
  partial: Truncation | null;
}

const NO_MATCHES: FileSearch = { matches: [], partial: null };

// every match in the file, in the order the diff reads: hunk by hunk, line by line. a line
// is searched once, so a context line shown on both sides of a split view is one match.
export function findFileMatches(file: DiffFile, query: string): FileSearch {
  const regex = compileQuery(query);
  if (!regex) return NO_MATCHES;
  const matches: FileMatch[] = [];
  let capped = false;
  let cut = false;
  let order = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const scan = rangesInLine(regex, line.content, query.length);
      capped ||= scan.capped;
      cut ||= scan.cut;
      for (const range of scan.ranges) {
        if (matches.length >= MAX_FILE_MATCHES) return { matches, partial: "capped" };
        matches.push({ ...range, index: matches.length, order, oldLine: line.oldLine, newLine: line.newLine });
      }
      order++;
    }
  }
  return { matches, partial: capped ? "capped" : cut ? "cut" : null };
}

export const lineKey = (oldLine: number | null, newLine: number | null): string => `${oldLine ?? ""}:${newLine ?? ""}`;

export function groupByLine(matches: FileMatch[]): Map<string, LineHit[]> {
  const byLine = new Map<string, LineHit[]>();
  for (const m of matches) {
    const key = lineKey(m.oldLine, m.newLine);
    const hit: LineHit = { index: m.index, start: m.start, end: m.end };
    const list = byLine.get(key);
    if (list) list.push(hit);
    else byLine.set(key, [hit]);
  }
  return byLine;
}

// wraps each hit of a line in <mark>; the active one gets the stronger class.
export function markHits(html: string, hits: LineHit[] | undefined, active: number): string {
  if (!hits) return html;
  return hits.reduce((out, h) => markRange(out, h.start, h.end, h.index === active ? ACTIVE_MATCH_CLASS : MATCH_CLASS), html);
}

// flat index of the diff line the cursor is on (-1 when it is not in this file).
export function orderOfCursor(file: DiffFile, pos: { path: string; side: Side; line: number } | null): number {
  if (!pos || pos.path !== file.path) return -1;
  let order = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if ((pos.side === "new" ? line.newLine : line.oldLine) === pos.line) return order;
      order++;
    }
  }
  return -1;
}

// the match a step lands on. from "no match yet" (active -1) a forward step goes to the nearest
// match at or after the cursor line, a backward step to the nearest one before it; after that it
// walks the list, wrapping at both ends. `delta` is signed and may be larger than the list.
export function stepTarget(matches: FileMatch[], active: number, delta: number, cursorOrder: number): number {
  const total = matches.length;
  if (total === 0 || delta === 0) return -1;
  const wrap = (i: number): number => ((i % total) + total) % total;
  if (active >= 0) return wrap(active + delta);
  if (delta > 0) {
    const first = cursorOrder < 0 ? 0 : matches.findIndex((m) => m.order >= cursorOrder);
    return wrap((first === -1 ? 0 : first) + delta - 1);
  }
  let before = total - 1;
  if (cursorOrder >= 0) {
    const index = matches.findLastIndex((m) => m.order < cursorOrder);
    if (index !== -1) before = index;
  }
  return wrap(before + delta + 1);
}
