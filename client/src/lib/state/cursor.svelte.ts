// the line cursor: where keyboard review is reading. holds { path, side, line } plus the text
// under it (the anchor that survives a refresh), a jump history, and a reveal request the diff
// pane turns into a scroll. motion itself lives in cursorSteps.ts as pure functions.

import { untrack } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { DiffFile } from "$types";
import type { Side } from "$lib/diff/threads";
import { GIANT_FILE_LINES, lineCountOf } from "$lib/diff/metrics";
import {
  FILE_LEVEL, contentAt, firstLine, goToLineNumber, lastLine, moveFiles, moveHunks, moveLines,
  reanchor, samePos, switchSide, type CursorPos, type FileView,
} from "./cursorSteps";
import { EMPTY_HISTORY, jumpBack, jumpForward, recordJump, type JumpHistory } from "./jumpHistory";

export interface CursorDeps {
  files: () => DiffFile[]; // in sidebar order
  defaultSplit: (file: DiffFile) => boolean; // before the file body reports what it shows
  activePath: () => string | null;
  follow: (path: string) => void;
}

// what a mounted file body tells the cursor about itself.
export interface BodyReport {
  split: boolean;
  navigable: boolean;
}

export type RevealKind = "line" | "file";

// a file the body would not render lines for until someone loads or expands it.
function defaultNavigable(file: DiffFile): boolean {
  return !file.binary && file.hunks.length > 0 && file.changeType !== "deleted" && lineCountOf(file) <= GIANT_FILE_LINES;
}

export function createCursorStore(deps: CursorDeps) {
  let pos = $state<CursorPos | null>(null);
  let pref = $state<Side>("new");
  let revealSeq = $state(0);
  let revealKind: RevealKind = "line";
  let anchor: string | null = null;
  let history: JumpHistory = EMPTY_HISTORY;
  let followed: string | null = null;
  const bodies = new SvelteMap<string, BodyReport>();

  function views(): FileView[] {
    return deps.files().map((file) => {
      const body = bodies.get(file.path);
      return { file, split: body?.split ?? deps.defaultSplit(file), navigable: body?.navigable ?? defaultNavigable(file) };
    });
  }

  // the position a motion starts from: the cursor, or the top of the file the reader is in.
  // a file picked some other way (sidebar) moves the start there.
  function base(seedPath: string | undefined): CursorPos | null {
    const active = deps.activePath();
    if (pos && (active === followed || active === null)) return pos;
    const path = active ?? seedPath ?? deps.files()[0]?.path;
    return path ? { path, side: pref, line: FILE_LEVEL } : null;
  }

  function commit(next: CursorPos | null, from: CursorPos | null, opts: { jump?: boolean; reveal: RevealKind }): void {
    if (!next) return;
    if (opts.jump) history = recordJump(history, from);
    pos = next;
    anchor = contentAt(views(), pref, next);
    followed = next.path;
    deps.follow(next.path);
    revealKind = opts.reveal;
    revealSeq++;
  }

  function run(seed: string | undefined, motion: (v: FileView[], from: CursorPos) => CursorPos | null, opts: { jump?: boolean; reveal?: RevealKind } = {}): void {
    const from = base(seed);
    if (!from) return;
    commit(motion(views(), from), from, { jump: opts.jump, reveal: opts.reveal ?? "line" });
  }

  function walk(step: typeof jumpBack, seed: string | undefined): void {
    const from = base(seed);
    const taken = step(history, from);
    if (!taken.target) return;
    history = taken.history;
    commit(reanchor(views(), pref, taken.target, null), from, { reveal: "line" });
  }

  return {
    get pos(): CursorPos | null {
      return pos;
    },
    get side(): Side {
      return pref;
    },
    get revealSeq(): number {
      return revealSeq;
    },
    get revealKind(): RevealKind {
      return revealKind;
    },
    posFor(path: string): CursorPos | null {
      return pos && pos.path === path ? pos : null;
    },

    lines: (seed: string | undefined, delta: number) => run(seed, (v, from) => moveLines(v, pref, from, delta)),
    files: (seed: string | undefined, delta: number) => run(seed, (v, from) => moveFiles(v, pref, from, delta), { jump: true, reveal: "file" }),
    hunks: (seed: string | undefined, delta: number) => run(seed, (v, from) => moveHunks(v, pref, from, delta), { jump: true }),
    top: (seed: string | undefined) => run(seed, (v, from) => firstLine(v, pref, from.path), { jump: true }),
    bottom: (seed: string | undefined) => run(seed, (v, from) => lastLine(v, pref, from.path), { jump: true }),
    lineNumber: (seed: string | undefined, number: number) => run(seed, (v, from) => goToLineNumber(v, pref, from.path, number), { jump: true }),
    switchTo(seed: string | undefined, target: Side): void {
      const from = base(seed);
      const next = from ? switchSide(views(), from, target) : null;
      if (!next) return;
      pref = target;
      commit(next, from, { reveal: "line" });
    },
    back: (seed: string | undefined) => walk(jumpBack, seed),
    forward: (seed: string | undefined) => walk(jumpForward, seed),

    // the diff changed under the cursor: keep the same line if it is still there, else the nearest.
    reconcile(): void {
      if (!pos) return;
      const next = reanchor(views(), pref, pos, anchor);
      if (samePos(next, pos)) return;
      pos = next;
      anchor = contentAt(views(), pref, next);
      followed = next?.path ?? null;
    },

    reportBody(path: string, report: BodyReport): void {
      const known = untrack(() => bodies.get(path));
      if (!known || known.split !== report.split || known.navigable !== report.navigable) bodies.set(path, report);
    },
    forgetBody(path: string): void {
      untrack(() => bodies.delete(path));
    },
  };
}

export type CursorStore = ReturnType<typeof createCursorStore>;
