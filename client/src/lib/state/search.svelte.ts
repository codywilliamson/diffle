// in-file search state: the query, the file it runs on, and which match is active. matches are
// derived from the diff so they follow a refresh; stepping moves the line cursor (a jump).

import { SvelteSet } from "svelte/reactivity";
import type { DiffFile } from "$types";
import { findFileMatches, groupByLine, orderOfCursor, stepTarget, type FileSearch, type LineHit } from "$lib/diff/search";
import type { CursorPos } from "./cursorSteps";

export interface SearchDeps {
  file: (path: string) => DiffFile | undefined;
  cursorPos: () => CursorPos | null;
  goToLine: (path: string, oldLine: number | null, newLine: number | null) => void;
}

export const INTERDIFF_NOTICE = "Search isn't available in the changes-since-last-review view.";
const NOTICE_MS = 4000;
const NO_HITS = new Map<string, LineHit[]>();

export function createSearchStore(deps: SearchDeps) {
  let open = $state(false);
  let path = $state<string | null>(null);
  let query = $state("");
  let rawActive = $state(-1);
  let focusSeq = $state(0); // bumps whenever the input should (re)take focus

  let notice = $state<string | null>(null);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  // files showing the changes-since-last-review view: its lines differ from the diff, so search stays out
  const interdiffPaths = new SvelteSet<string>();

  const result = $derived.by((): FileSearch => {
    const file = open && path ? deps.file(path) : undefined;
    return file ? findFileMatches(file, query) : { matches: [], partial: null };
  });
  const matches = $derived(result.matches);
  const byLine = $derived(matches.length ? groupByLine(matches) : NO_HITS);
  const active = $derived(rawActive < matches.length ? rawActive : -1);

  function step(delta: number): void {
    const file = path ? deps.file(path) : undefined;
    if (!file || !open) return;
    const target = stepTarget(matches, active, delta, orderOfCursor(file, deps.cursorPos()));
    const match = matches[target];
    if (!match) return;
    rawActive = target;
    deps.goToLine(file.path, match.oldLine, match.newLine);
  }

  return {
    get open(): boolean {
      return open;
    },
    get path(): string | null {
      return path;
    },
    get query(): string {
      return query;
    },
    get total(): number {
      return matches.length;
    },
    get active(): number {
      return active;
    },
    get partial() {
      return result.partial;
    },
    get notice(): string | null {
      return notice;
    },
    // a file body tells search when it switches to or from the interdiff view
    setInterdiff(filePath: string, on: boolean): void {
      if (on) interdiffPaths.add(filePath);
      else interdiffPaths.delete(filePath);
      if (on && open && path === filePath) this.close();
    },
    get focusSeq(): number {
      return focusSeq;
    },
    hitsFor(filePath: string, oldLine: number | null, newLine: number | null): LineHit[] | undefined {
      return open && filePath === path ? byLine.get(`${oldLine ?? ""}:${newLine ?? ""}`) : undefined;
    },

    // `/`: search `filePath`. a selection prefills the query; otherwise the last query is kept.
    start(filePath: string | undefined, prefill: string): void {
      if (!filePath) return;
      if (interdiffPaths.has(filePath)) {
        notice = INTERDIFF_NOTICE;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => (notice = null), NOTICE_MS);
        return;
      }
      if (prefill) query = prefill;
      if (!open || path !== filePath) rawActive = -1;
      path = filePath;
      open = true;
      focusSeq++;
    },
    setQuery(next: string): void {
      query = next;
      rawActive = -1;
    },
    next: (count = 1) => step(count),
    prev: (count = 1) => step(-count),
    close(): void {
      open = false;
      notice = null;
      rawActive = -1;
    },
  };
}

export type SearchStore = ReturnType<typeof createSearchStore>;
