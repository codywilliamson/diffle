import type { MovedBlock } from "$types";
import type { Side } from "./threads";

export interface MovedMark {
  label: string; // e.g. "moved from Foo.cs:12 (edited)"
  file: string; // the other end of the move, for navigation
  first: boolean; // the label shows once, on the block's first line
}

export interface MovedLookup {
  mark(side: Side, line: number): MovedMark | null;
}

const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

function describe(verb: "from" | "to", other: { file: string; start: number }, edited: boolean): string {
  return `moved ${verb} ${baseName(other.file)}:${other.start}${edited ? " (edited)" : ""}`;
}

function addRange(map: Map<string, MovedMark>, side: Side, start: number, end: number, label: string, file: string): void {
  for (let line = start; line <= end; line++) map.set(`${side}:${line}`, { label, file, first: line === start });
}

// per-file lookup: new-side lines of blocks that landed here, old-side lines of blocks that left.
export function movedLookup(blocks: MovedBlock[], path: string): MovedLookup {
  const marks = new Map<string, MovedMark>();
  for (const block of blocks) {
    if (block.to.file === path) addRange(marks, "new", block.to.start, block.to.end, describe("from", block.from, block.edited), block.from.file);
    if (block.from.file === path) addRange(marks, "old", block.from.start, block.from.end, describe("to", block.to, block.edited), block.to.file);
  }
  return { mark: (side, line) => marks.get(`${side}:${line}`) ?? null };
}

export const NO_MOVED: MovedLookup = { mark: () => null };
