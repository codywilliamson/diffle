// the line cursor: where keyboard review is reading. holds { path, side, line } plus the text
// under it (the anchor that survives a refresh), a jump history, and a reveal request the diff
// pane turns into a scroll. motion itself lives in cursorSteps.ts as pure functions.

import { untrack } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { DiffFile } from "$types";
import type { Side } from "$lib/diff/threads";
import { GIANT_FILE_LINES, lineCountOf } from "$lib/diff/metrics";
import {
  FILE_LEVEL, buildIndex, contentAt, firstLine, goToLineNumber, lastLine, moveFiles, moveHunks, moveLines,
  reanchor, samePos, switchSide, type CursorPos, type FileView, type StopIndex,
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

interface Snapshot {
  files: DiffFile[];
  sig: string;
  pref: Side;
  views: FileView[];
  index: StopIndex;
}

export function createCursorStore(deps: CursorDeps) {
  let pos = $state<CursorPos | null>(null);
  let pref = $state<Side>("new");
  let revealSeq = $state(0);
  let revealKind: RevealKind = "line";
  let anchor: string | null = null;
  let history: JumpHistory = EMPTY_HISTORY;
  let followed: string | null = null;
  let cache: Snapshot | null = null;
  const bodies = new SvelteMap<string, BodyReport>();

  // views and the flattened stops, rebuilt only when the files, a body's mode or the side change.
  function snapshot(): Snapshot {
    const files = deps.files();
    const views = files.map((file) => {
      const body = bodies.get(file.path);
      return { file, split: body?.split ?? deps.defaultSplit(file), navigable: body?.navigable ?? defaultNavigable(file) };
    });
    const sig = views.map((v) => `${v.split ? "s" : "u"}${v.navigable ? "n" : "x"}`).join("");
    const fresh = cache && cache.pref === pref && cache.sig === sig && cache.files.length === files.length && cache.files.every((f, i) => f === files[i]);
    if (!cache || !fresh) cache = { files, sig, pref, views, index: buildIndex(views, pref) };
    return cache;
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
    const { views, index } = snapshot();
    anchor = contentAt(views, pref, next, index);
    followed = next.path;
    deps.follow(next.path);
    revealKind = opts.reveal;
    revealSeq++;
  }

  type Motion = (views: FileView[], from: CursorPos, index: StopIndex) => CursorPos | null;

  function run(seed: string | undefined, motion: Motion, opts: { jump?: boolean; reveal?: RevealKind } = {}): void {
    const from = base(seed);
    if (!from) return;
    const { views, index } = snapshot();
    commit(motion(views, from, index), from, { jump: opts.jump, reveal: opts.reveal ?? "line" });
  }

  function walk(step: typeof jumpBack, seed: string | undefined): void {
    const from = base(seed);
    const taken = step(history, from);
    const target = taken.target;
    if (!target) return;
    history = taken.history;
    // restore the side the jump was recorded on before resolving it
    if (snapshot().views.find((v) => v.file.path === target.path)?.split) pref = target.side;
    const { views, index } = snapshot();
    commit(reanchor(views, pref, target, null, index), from, { reveal: "line" });
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

    lines: (seed: string | undefined, delta: number) => run(seed, (v, from, i) => moveLines(v, pref, from, delta, i)),
    files: (seed: string | undefined, delta: number) => run(seed, (v, from, i) => moveFiles(v, pref, from, delta, i), { jump: true, reveal: "file" }),
    hunks: (seed: string | undefined, delta: number) => run(seed, (v, from, i) => moveHunks(v, pref, from, delta, i), { jump: true }),
    top: (seed: string | undefined) => run(seed, (v, from, i) => firstLine(v, pref, from.path, i), { jump: true }),
    bottom: (seed: string | undefined) => run(seed, (v, from, i) => lastLine(v, pref, from.path, i), { jump: true }),
    lineNumber: (seed: string | undefined, number: number) => run(seed, (v, from) => goToLineNumber(v, pref, from.path, number), { jump: true }),
    switchTo(seed: string | undefined, target: Side): void {
      const from = base(seed);
      const next = from ? switchSide(snapshot().views, from, target) : null;
      if (!next) return;
      pref = target;
      commit(next, from, { reveal: "line" });
    },
    back: (seed: string | undefined) => walk(jumpBack, seed),
    forward: (seed: string | undefined) => walk(jumpForward, seed),

    // the diff changed under the cursor: keep the same line if it is still there, else the nearest,
    // and ask the pane to scroll to wherever it ended up.
    reconcile(): void {
      if (!pos) return;
      const { views, index } = snapshot();
      const next = reanchor(views, pref, pos, anchor, index);
      if (samePos(next, pos)) return;
      pos = next;
      const fresh = snapshot();
      anchor = contentAt(fresh.views, pref, next, fresh.index);
      followed = next?.path ?? null;
      if (next) {
        revealKind = "line";
        revealSeq++;
      }
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
