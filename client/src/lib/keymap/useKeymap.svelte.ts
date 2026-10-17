// wires the pure parser to the app: keydown in, store calls out. call during App init.

import { untrack } from "svelte";
import { getAppState } from "$lib/state/context";
import { useOrderedFiles } from "$lib/state/orderedFiles.svelte";
import { currentFile } from "$lib/diff/currentFile";
import { ROW_HEIGHT } from "$lib/diff/metrics";
import { isEditable } from "./editable";
import { createActions } from "./actions";
import { EMPTY_STATE, step } from "./parser";
import type { KeyInput, Mode } from "./types";

// right after a sidebar selection the pane is still smooth-scrolling to it, so trust the
// selection over the scroll position.
const SMOOTH_SCROLL_MS = 600;
const NORMAL: Mode = "normal"; // visual and search modes arrive with #176-#178

export interface Keymap {
  onKeydown: (event: KeyboardEvent) => void;
  onKeydownCapture: (event: KeyboardEvent) => void;
}

export function useKeymap(): Keymap {
  const app = getAppState();
  const { ui, prefs } = app;
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

  const actions = createActions({ app, currentPath, halfPageRows });

  // Esc runs in the capture phase so a pending count or chord is cancelled before an editor or
  // dialog swallows the event. outside a field the Esc is consumed (it only cancels the count);
  // inside one it passes through, so the editor still closes on the same press.
  const onKeydownCapture = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || (state.count === "" && state.prefix === null)) return;
    state = EMPTY_STATE;
    if (isEditable(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const input: KeyInput = {
      key: event.key,
      ctrl: event.ctrlKey,
      altGraph: event.getModifierState?.("AltGraph") ?? false,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey,
      editable: isEditable(event.target),
    };
    const { state: next, outcome } = step(state, input, NORMAL, performance.now());
    state = next;
    switch (outcome.kind) {
      case "ignored":
        return;
      case "escape":
        // nothing pending: leave search first (one layer per press). an open dialog closes
        // itself on this same Esc (Modal), so its own dismiss logic (what's new) still runs.
        if (ui.activeOverlay || !app.search.open) return;
        app.search.close();
        break;
      case "dispatch": {
        const { binding, count } = outcome;
        // motion is paused behind an open dialog
        const paused = (binding.group === "Move" || binding.group === "Search") && ui.activeOverlay;
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
