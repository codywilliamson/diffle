// detects moved code: runs of deleted lines that reappear as added lines, in any file.
// matching is on trimmed text, seeded only by non-trivial lines so braces never fake a move.

import type { DiffFile, MovedBlock } from "../../types";

export const MIN_MOVED_LINES = 3;
const MAX_CANDIDATES_PER_SEED = 16;
const TRIVIAL_LINE = /^[{}()[\];,.]*$/;
const TRIVIAL_WORDS = new Set(["end", "end;", "else", "else:", "try", "try:", "finally", "endif", "fi", "done", "begin", "*/", "/*", "break;", "return;"]);

interface Entry {
  file: string;
  line: number;
  norm: string;
  trivial: boolean;
  used: boolean;
}

function isTrivial(norm: string): boolean {
  return TRIVIAL_LINE.test(norm) || TRIVIAL_WORDS.has(norm);
}

function collect(files: DiffFile[], side: "deletion" | "addition"): Entry[] {
  const entries: Entry[] = [];
  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const l of hunk.lines) {
        const line = side === "deletion" ? l.oldLine : l.newLine;
        if (l.type !== side || line === null) continue;
        const norm = l.content.trim();
        entries.push({ file: file.path, line, norm, trivial: isTrivial(norm), used: false });
      }
    }
  }
  return entries;
}

function follows(prev: Entry, next: Entry | undefined): next is Entry {
  return !!next && next.file === prev.file && next.line === prev.line + 1;
}

interface Match {
  length: number; // pairs spanned, from the seed to the last matched pair
  solid: number; // non-trivial verbatim matches
  edited: boolean;
}

// walks dels[i..] and adds[j..] in lockstep, tolerating single-line edits between matches.
function extend(dels: Entry[], adds: Entry[], i: number, j: number): Match {
  let best: Match = { length: 1, solid: 1, edited: false };
  let k = 1;
  let solid = 1;
  let edited = false;
  while (follows(dels[i + k - 1]!, dels[i + k]) && follows(adds[j + k - 1]!, adds[j + k])) {
    const d = dels[i + k]!;
    const a = adds[j + k]!;
    if (!d.used && !a.used && d.norm === a.norm) {
      if (!d.trivial) solid++;
      k++;
      best = { length: k, solid, edited };
      continue;
    }
    // one differing line is allowed only when the next pair matches again
    const nd = dels[i + k + 1];
    const na = adds[j + k + 1];
    const bridges = nd && na && follows(d, nd) && follows(a, na) && !nd.used && !na.used && nd.norm === na.norm && !nd.trivial;
    if (!bridges) break;
    edited = true;
    solid++;
    k += 2;
    best = { length: k, solid, edited };
  }
  return best;
}

function indexByText(adds: Entry[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  adds.forEach((a, pos) => {
    if (a.trivial) return;
    const list = index.get(a.norm);
    if (list) list.push(pos);
    else index.set(a.norm, [pos]);
  });
  return index;
}

export function detectMovedBlocks(files: DiffFile[]): MovedBlock[] {
  const dels = collect(files, "deletion");
  const adds = collect(files, "addition");
  const index = indexByText(adds);
  const blocks: MovedBlock[] = [];

  for (let i = 0; i < dels.length; i++) {
    const seed = dels[i]!;
    if (seed.trivial || seed.used) continue;
    let bestJ = -1;
    let best: Match | null = null;
    for (const j of (index.get(seed.norm) ?? []).slice(0, MAX_CANDIDATES_PER_SEED)) {
      if (adds[j]!.used) continue;
      const m = extend(dels, adds, i, j);
      if (!best || m.length > best.length) {
        best = m;
        bestJ = j;
      }
    }
    if (!best || best.solid < MIN_MOVED_LINES) continue;
    for (let k = 0; k < best.length; k++) {
      dels[i + k]!.used = true;
      adds[bestJ + k]!.used = true;
    }
    const last = best.length - 1;
    blocks.push({
      from: { file: seed.file, start: seed.line, end: dels[i + last]!.line },
      to: { file: adds[bestJ]!.file, start: adds[bestJ]!.line, end: adds[bestJ + last]!.line },
      edited: best.edited,
    });
    i += last;
  }

  return blocks.sort((a, b) => a.from.file.localeCompare(b.from.file) || a.from.start - b.from.start);
}

// changed lines in `path` covered by a moved block, counting both the removed and added side.
export function movedLineCount(blocks: MovedBlock[], path: string): number {
  let count = 0;
  for (const b of blocks) {
    if (b.from.file === path) count += b.from.end - b.from.start + 1;
    if (b.to.file === path) count += b.to.end - b.to.start + 1;
  }
  return count;
}
