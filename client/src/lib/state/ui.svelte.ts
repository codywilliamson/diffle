// ephemeral view state: which single overlay is open, the selected file, the mobile drawer,
// and the live comment-composition (add + drag-select) state. no persistence and no server.

import type { AddTarget, SelectTarget, Side } from "$lib/diff/threads";

export const UNDO_MS = 8000;

export interface UndoOffer {
  text: string;
  run: () => void;
  seq: number;
}

export type OverlayName = "help" | "whatsNew" | "compile" | "scorecard";

export function createUiStore() {
  let activeOverlay = $state<OverlayName | null>(null);
  let feedbackSummary = $state<string | null>(null);
  let activeFile = $state<string | null>(null);
  // bumps on every explicit selection (sidebar, links) so the diff pane scrolls to it; the
  // keyboard cursor follows files without a request, since it scrolls itself.
  let scrollRequest = $state<{ path: string } | null>(null);
  // bumps when something outside the file (search results) needs it expanded and loaded.
  let openRequest = $state<{ path: string } | null>(null);
  let drawerOpen = $state(false);
  let adding = $state<AddTarget | null>(null);
  let selecting = $state<SelectTarget | null>(null);
  let editingComment = $state<string | null>(null);
  let undo = $state<UndoOffer | null>(null);
  let undoSeq = 0;
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    get activeOverlay(): OverlayName | null {
      return activeOverlay;
    },
    get activeFile(): string | null {
      return activeFile;
    },
    get scrollRequest(): { path: string } | null {
      return scrollRequest;
    },
    get openRequest(): { path: string } | null {
      return openRequest;
    },
    requestOpen(path: string): void {
      openRequest = { path };
    },
    get feedbackSummary(): string | null {
      return feedbackSummary;
    },
    get drawerOpen(): boolean {
      return drawerOpen;
    },
    // only one overlay is ever active, so escape can close "the active overlay".
    openOverlay(name: OverlayName): void {
      activeOverlay = name;
      if (name === "compile") feedbackSummary = null;
    },
    openFeedbackPreview(summary?: string): void {
      feedbackSummary = summary ?? null;
      activeOverlay = "compile";
    },
    closeOverlay(): void {
      activeOverlay = null;
      feedbackSummary = null;
    },
    toggleOverlay(name: OverlayName): void {
      activeOverlay = activeOverlay === name ? null : name;
    },
    // selecting a file also closes the drawer, since on narrow screens selecting IS navigating.
    selectFile(path: string): void {
      activeFile = path;
      scrollRequest = { path };
      drawerOpen = false;
    },
    // mark a file active without asking the pane to scroll (the line cursor moved there).
    followFile(path: string): void {
      activeFile = path;
    },
    openDrawer(): void {
      drawerOpen = true;
    },
    closeDrawer(): void {
      drawerOpen = false;
    },

    // comment composition — the open editor's target and the live drag-select range.
    get adding(): AddTarget | null {
      return adding;
    },
    get selecting(): SelectTarget | null {
      return selecting;
    },
    // the comment whose card shows its editor (the e key and the Edit button)
    get editingComment(): string | null {
      return editingComment;
    },
    startEdit(id: string): void {
      editingComment = id;
    },
    // only closes the editor it names: a save finishing for one comment must not close another's
    stopEdit(id: string): void {
      if (editingComment === id) editingComment = null;
    },
    // a short-lived "Undo" offer (a comment was just deleted)
    get undo(): UndoOffer | null {
      return undo;
    },
    offerUndo(text: string, run: () => void): void {
      clearTimeout(undoTimer);
      undo = { text, run, seq: ++undoSeq };
      undoTimer = setTimeout(() => (undo = null), UNDO_MS);
    },
    runUndo(): boolean {
      const offer = undo;
      if (!offer) return false;
      clearTimeout(undoTimer);
      undo = null;
      offer.run();
      return true;
    },
    startLineAdd(file: string, side: Side, line: number): void {
      adding = { file, side, line, endLine: line };
      selecting = null;
    },
    startFileAdd(file: string): void {
      adding = { file, line: null };
      selecting = null;
    },
    cancelAdd(): void {
      adding = null;
      selecting = null;
    },
    selectMove(file: string, side: Side, from: number, to: number): void {
      selecting = { file, side, from, to };
    },
    clearSelect(): void {
      selecting = null;
    },
    selectCommit(file: string, side: Side, lo: number, hi: number): void {
      adding = { file, side, line: lo, endLine: hi };
      selecting = null;
    },
    // shift-click extends the open editor's range on the same side; otherwise starts a new one.
    extendAdd(file: string, side: Side, line: number): void {
      if (!adding || adding.file !== file || adding.line == null || (adding.side ?? "new") !== side) {
        adding = { file, side, line, endLine: line };
        return;
      }
      adding = { file, side, line: Math.min(adding.line, line), endLine: Math.max(adding.endLine ?? adding.line, line) };
    },
  };
}

export type UiStore = ReturnType<typeof createUiStore>;
