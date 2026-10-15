// ephemeral view state: which single overlay is open, the selected file, the mobile drawer,
// the live comment-composition (add + drag-select) state, and the comment to jump to.
// no persistence and no server.

import type { AddTarget, SelectTarget, Side } from "$lib/diff/threads";

export type OverlayName = "help" | "whatsNew" | "compile" | "scorecard" | "threads";

// a jump request from the threads panel; the matching file section opens, scrolls and clears it.
export interface FocusTarget {
  file: string;
  commentId: string;
}

export function createUiStore() {
  let activeOverlay = $state<OverlayName | null>(null);
  let feedbackSummary = $state<string | null>(null);
  let activeFile = $state<string | null>(null);
  let drawerOpen = $state(false);
  let adding = $state<AddTarget | null>(null);
  let selecting = $state<SelectTarget | null>(null);
  let focus = $state<FocusTarget | null>(null);

  return {
    get activeOverlay(): OverlayName | null {
      return activeOverlay;
    },
    get activeFile(): string | null {
      return activeFile;
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
      drawerOpen = false;
    },
    get focus(): FocusTarget | null {
      return focus;
    },
    // select the file (single-file view switches to it), close the overlay, then let the section scroll.
    focusComment(file: string, commentId: string): void {
      activeFile = file;
      drawerOpen = false;
      activeOverlay = null;
      focus = { file, commentId };
    },
    clearFocus(): void {
      focus = null;
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
