// the line cursor: where keyboard review is reading. holds { path, side, line } plus the text
// under it (the anchor that survives a refresh), a jump history, and a reveal request the diff
// pane turns into a scroll. motion itself lives in cursorSteps.ts as pure functions.

import { untrack } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { DiffFile, SearchHit } from "$types";
import type { Side } from "$lib/diff/threads";
import { GIANT_FILE_LINES, lineCountOf } from "$lib/diff/metrics";
import {
  FILE_LEVEL, buildIndex, contentAt, firstLine, goToLineNumber, lastLine, moveFiles, moveHunks, moveLines, ownStops,
  reanchor, samePos, switchSide, type CursorPos, type FileView, type StopIndex,
} from "./cursorSteps";
import { resolveVisual, type VisualRange } from "./cursorVisual";
import { findHitStop, resolveHitFile } from "./cursorHit";
import { EMPTY_HISTORY, jumpBack, jumpForward, recordJump, type JumpHistory } from "./jumpHistory";

export interface CursorDeps {
  files: () => DiffFile[]; // in sidebar order
  defaultSplit: (file: DiffFile) => boolean; // before the file body reports what it shows
  activePath: () => string | null;
  follow: (path: string) => void;
  open?: (path: string) => void; // expand, load or un-preview a file so its lines can be rested on
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
  let visualAnchor = $state<CursorPos | null>(null);
  let revealSeq = $state(0);
  let revealKind: RevealKind = "line";
  let anchor: string | null = null;
  let history: JumpHistory = EMPTY_HISTORY;
  let followed: string | null = null;
  let cache: Snapshot | null = null;
  const bodies = new SvelteMap<string, BodyReport>();
  let pendingHit: SearchHit | null = null; // a search hit waiting for its file to become navigable

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

  // while a range is open the cursor cannot leave the file it started in: past an edge it stops there
  function keepInVisualFile(next: CursorPos, index: StopIndex): CursorPos {
    if (!visualAnchor || next.path === visualAnchor.path) return next;
    const own = ownStops(index, visualAnchor.path);
    if (own.length === 0) return visualAnchor;
    const after = (index.fileOf.get(next.path) ?? 0) > (index.fileOf.get(visualAnchor.path) ?? 0);
    const edge = own[after ? own.length - 1 : 0]!;
    return { path: edge.path, side: edge.side, line: edge.line };
  }

  function commit(target: CursorPos | null, from: CursorPos | null, opts: { jump?: boolean; reveal: RevealKind }): void {
    if (!target) return;
    pendingHit = null;
    const next = keepInVisualFile(target, snapshot().index);
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
    // an open range stays on its side and file: entries that would leave them are passed over
    let taken = step(history, from);
    while (taken.target && visualAnchor && (taken.target.path !== visualAnchor.path || taken.target.side !== visualAnchor.side)) {
      taken = step(taken.history, taken.target);
    }
    const target = taken.target;
    if (!target) return;
    history = taken.history;
    // restore the side the jump was recorded on before resolving it
    if (snapshot().views.find((v) => v.file.path === target.path)?.split) pref = target.side;
    const { views, index } = snapshot();
    commit(reanchor(views, pref, target, null, index), from, { reveal: "line" });
  }

  function commentPos(seed: string | undefined): CursorPos | null {
    // nothing yet, parked on a header, or the reader picked another file: land on its first line
    if (base(seed)?.line === FILE_LEVEL) run(seed, (v, from, i) => firstLine(v, pref, from.path, i));
    return base(seed);
  }

  // land on a search hit. false when its file has no lines to rest on yet (collapsed, gated).
  function landOnHit(hit: SearchHit): boolean {
    const file = resolveHitFile(deps.files(), hit);
    if (!file) return true;
    const view = snapshot().views.find((v) => v.file.path === file.path);
    if (!view?.navigable) return false;
    if (view.split) pref = hit.side;
    const stop = findHitStop(snapshot().index, file.path, hit.side, hit.line, view.split);
    if (stop) commit({ path: file.path, side: stop.side, line: stop.line }, base(file.path), { jump: true, reveal: "line" });
    return true;
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
    get visual(): boolean {
      return visualAnchor !== null;
    },
    // the visual range as the mouse would have selected it, or null outside visual mode
    get visualRange(): VisualRange | null {
      if (!visualAnchor) return null;
      return resolveVisual(snapshot().index, visualAnchor, pos);
    },
    // where a comment starts: the cursor, landing on the first line when nothing has moved yet
    commentPos,
    startVisual(seed: string | undefined): void {
      const from = commentPos(seed);
      if (from && from.line !== FILE_LEVEL) visualAnchor = from;
    },
    endVisual(): void {
      visualAnchor = null;
    },
    posFor(path: string): CursorPos | null {
      return pos && pos.path === path ? pos : null;
    },

    lines: (seed: string | undefined, delta: number) => run(seed, (v, from, i) => moveLines(v, pref, from, delta, i)),
    // move to a measured destination (rendered rows), else step `fallback` rows
    page: (seed: string | undefined, measured: () => CursorPos | null, fallback: number) =>
      run(seed, (v, from, i) => measured() ?? moveLines(v, pref, from, fallback, i)),
    files: (seed: string | undefined, delta: number) => run(seed, (v, from, i) => moveFiles(v, pref, from, delta, i), { jump: true, reveal: "file" }),
    hunks: (seed: string | undefined, delta: number) => run(seed, (v, from, i) => moveHunks(v, pref, from, delta, i), { jump: true }),
    top: (seed: string | undefined) => run(seed, (v, from, i) => firstLine(v, pref, from.path, i), { jump: true }),
    bottom: (seed: string | undefined) => run(seed, (v, from, i) => lastLine(v, pref, from.path, i), { jump: true }),
    lineNumber: (seed: string | undefined, number: number) => run(seed, (v, from) => goToLineNumber(v, pref, from.path, number), { jump: true }),
    switchTo(seed: string | undefined, target: Side): void {
      if (visualAnchor) return; // the range stays on the side it started on
      const from = base(seed);
      const next = from ? switchSide(snapshot().views, from, target) : null;
      if (!next) return;
      pref = target;
      commit(next, from, { reveal: "line" });
    },
    // land on a specific diff line (a search match), recording a jump. in a split file the cursor
    // changes side when the line only exists on the other one.
    goToLine(path: string, oldLine: number | null, newLine: number | null): void {
      const find = (): CursorPos | null => {
        const { index } = snapshot();
        const fi = index.fileOf.get(path);
        if (fi === undefined) return null;
        const stop = index.stops.slice(index.fileStart[fi], index.fileStart[fi + 1]).find((s) => s.oldLine === oldLine && s.newLine === newLine);
        return stop ? { path, side: stop.side, line: stop.line } : null;
      };
      const from = base(path);
      let target = find();
      if (!target) {
        const previous = pref;
        pref = previous === "new" ? "old" : "new";
        target = find();
        if (!target) pref = previous;
      }
      commit(target, from, { jump: true, reveal: "line" });
    },
    // a result from the cross-file search: opens the file first when it is collapsed or gated
    goToHit(hit: SearchHit): void {
      pendingHit = null;
      if (landOnHit(hit)) return;
      pendingHit = hit;
      const file = resolveHitFile(deps.files(), hit);
      if (file) deps.open?.(file.path);
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
      if (pendingHit && untrack(() => landOnHit(pendingHit as SearchHit))) pendingHit = null;
    },
    forgetBody(path: string): void {
      untrack(() => bodies.delete(path));
    },
  };
}

export type CursorStore = ReturnType<typeof createCursorStore>;
