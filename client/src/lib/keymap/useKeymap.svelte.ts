// wires the pure parser to the app: keydown in, store calls out. call during App init.

import { untrack } from "svelte";
import { getAppState } from "$lib/state/context";
import { useOrderedFiles } from "$lib/state/orderedFiles.svelte";
import { currentFile } from "$lib/diff/currentFile";
import { ROW_HEIGHT } from "$lib/diff/metrics";
import { isEditable } from "./editable";
import { createActions } from "./actions";
import { escEndsVisual } from "./escapeLayer";
import { EMPTY_STATE, step } from "./parser";
import { repeatAllowed } from "./repeat";
import type { KeyInput } from "./types";

// right after a sidebar selection the pane is still smooth-scrolling to it, so trust the
// selection over the scroll position.
const SMOOTH_SCROLL_MS = 600;
const OWN_KEYS_PANELS = "[data-search-results], [data-lsp-panel]";
const PAUSED_GROUPS = new Set(["Move", "Search", "Comment", "Code"]);

export interface Keymap {
  onKeydown: (event: KeyboardEvent) => void;
  onKeydownCapture: (event: KeyboardEvent) => void;
}

export function useKeymap(): Keymap {
  const app = getAppState();
  const { ui, prefs, cursor } = app;
  const ordered = useOrderedFiles();
  let state = EMPTY_STATE;
  let lastSelectAt = -Infinity;

  $effect(() => {
    if (ui.scrollRequest) lastSelectAt = untrack(() => performance.now());
  });

  function currentPath(): string | undefined {
    const paths = ordered.files.map((file) => file.path);
    const followScroll = prefs.fileView === "all" && performance.now() - lastSelectAt > SMOOTH_SCROLL_MS;
    return followScroll ? currentFile(paths, ui.activeFile) : (ui.activeFile ?? paths[0]);
  }

  function halfPageRows(): number {
    const pane = document.querySelector("[data-diff-pane]");
    return Math.max(1, Math.floor((pane?.clientHeight ?? 0) / ROW_HEIGHT / 2));
  }

  // the visual range shows through the same highlight a mouse drag uses. a range that stopped
  // resolving (its file left the diff) ends the mode.
  $effect(() => {
    if (!cursor.visual) return;
    const range = cursor.visualRange;
    untrack(() => {
      if (range) ui.selectMove(range.path, range.side, range.from, range.to);
      else exitVisual();
    });
  });

  function exitVisual(): void {
    cursor.endVisual();
    ui.clearSelect();
  }

  const actions = createActions({ app, currentPath, halfPageRows });

  // Esc runs in the capture phase so a pending count or chord is cancelled before an editor or
  // dialog swallows the event. outside a field the Esc is consumed (it only cancels the count);
  // inside one it passes through, so the editor still closes on the same press.
  const onKeydownCapture = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    const pending = state.count !== "" || state.prefix !== null;
    // a pending count or chord goes first; otherwise Esc closes the topmost layer: an open dialog
    // sits above visual mode, so visual mode only ends once no dialog is open
    const endsVisual = escEndsVisual({
      pending, visual: cursor.visual, dialogOpen: !!ui.activeOverlay, codeLayerOpen: app.lsp.hasLayer || app.filePicker.open, inField: isEditable(event.target),
    });
    if (!pending && !endsVisual) return;
    state = EMPTY_STATE;
    if (!pending) exitVisual();
    if (isEditable(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  // hand the keyboard back to the page when the panel it was typed in disappears
  function closeSearchAll(): void {
    app.searchAll.close();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("[data-search-all]")) active.blur();
  }

  // hand the keyboard back to the page when the panel it was typed in disappears
  function closeLspFocus(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("[data-lsp-panel]")) active.blur();
  }

  // Ctrl+p and Cmd+p are the browser's print. while the picker is open the key belongs to it (a
  // second press closes it) even inside its own input; Cmd+p (macOS) opens it like Ctrl+p does.
  function pickerKey(event: KeyboardEvent): boolean {
    const chord = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "p";
    if (!chord) return false;
    if (app.filePicker.open) app.filePicker.close();
    else if (event.metaKey && !ui.activeOverlay && !isEditable(event.target) && !event.repeat) actions["file.pick"]?.(null);
    else return false;
    event.preventDefault();
    return true;
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (pickerKey(event)) return;
    // the results lists and code-navigation panels own their plain keys (j, k, arrows, Enter);
    // Esc and Ctrl+o stay the keymap's
    if (event.key !== "Escape" && !event.ctrlKey && (event.target as HTMLElement | null)?.closest?.(OWN_KEYS_PANELS)) return;
    const input: KeyInput = {
      key: event.key,
      ctrl: event.ctrlKey,
      altGraph: event.getModifierState?.("AltGraph") ?? false,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
      editable: isEditable(event.target),
    };
    const { state: next, outcome } = step(state, input, cursor.visual ? "visual" : "normal", performance.now());
    // a held key repeats only for motions; a swallowed repeat leaves the parser where it was
    if (event.repeat && !repeatAllowed(outcome)) {
      event.preventDefault();
      return;
    }
    state = next;
    switch (outcome.kind) {
      case "ignored":
        return;
      case "escape":
        // nothing pending: leave search first (one layer per press). an open dialog closes
        // itself on this same Esc (Modal), so its own dismiss logic (what's new) still runs.
        if (ui.activeOverlay) return;
        // code-navigation layers sit above the search docks: one layer per press
        if (app.filePicker.close()) closeLspFocus();
        else if (app.lsp.closeTopmost()) closeLspFocus();
        else if (app.searchAll.open) closeSearchAll();
        else if (app.search.open) app.search.close();
        else return;
        break;
      case "dispatch": {
        const { binding, count } = outcome;
        // motion, search, commenting and code navigation are paused behind an open dialog, and
        // behind the read-only viewer (except jumping back out of it)
        const covered = ui.activeOverlay || (app.lsp.viewer && !binding.action.startsWith("jump."));
        const paused = PAUSED_GROUPS.has(binding.group) && covered;
        if (!paused) actions[binding.action]?.(count);
        break;
      }
      default:
        break;
    }
    event.preventDefault();
  };

  return { onKeydown, onKeydownCapture };
}
