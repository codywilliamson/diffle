// ephemeral view state: which single overlay is open, the selected file, the mobile drawer,
// and the live comment-composition (add + drag-select) state. no persistence and no server.

import type { AddTarget, SelectTarget, Side } from "$lib/diff/threads";

export type OverlayName = "help" | "whatsNew" | "compile";

export function createUiStore() {
  let activeOverlay = $state<OverlayName | null>(null);
  let activeFile = $state<string | null>(null);
  let drawerOpen = $state(false);
  let adding = $state<AddTarget | null>(null);
  let selecting = $state<SelectTarget | null>(null);

  return {
    get activeOverlay(): OverlayName | null {
      return activeOverlay;
    },
    get activeFile(): string | null {
      return activeFile;
    },
    get drawerOpen(): boolean {
      return drawerOpen;
    },
    // only one overlay is ever active, so escape can close "the active overlay".
    openOverlay(name: OverlayName): void {
      activeOverlay = name;
    },
    closeOverlay(): void {
      activeOverlay = null;
    },
    toggleOverlay(name: OverlayName): void {
      activeOverlay = activeOverlay === name ? null : name;
    },
    // selecting a file also closes the drawer, since on narrow screens selecting IS navigating.
    selectFile(path: string): void {
      activeFile = path;
      drawerOpen = false;
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
