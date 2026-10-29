// code navigation: the coordinator behind gd, gy, gh, gA, gs and gS. it owns what the panels
// share (the toast, the several-targets picker, the read-only viewer, the word the pointer last
// rested on) and composes the hover, references and symbols stores. every jump goes through
// jump.ts, so definitions, references and symbols all land by the same rule.

import type { DiffFile, LspDefinitionKind, LspDefinitionResponse, LspPositionRequest, LspTarget, SearchHit } from "$types";
import { getFile } from "$lib/api/meta";
import {
  isAbort, lspDefinition, lspDocumentSymbols, lspErrorOf, lspFile, lspHover, lspMessage, lspReferences, lspWorkspaceSymbols,
} from "$lib/api/lsp";
import { JUMP_HISTORY_CAP } from "$lib/keymap/keymap";
import { cursorHit, viewerHit } from "./cursorToken";
import type { CodeHit } from "./domPosition";
import { createHoverStore } from "./hover.svelte";
import { sameStamp } from "./stamp";
import { jumpTo, targetOf, type JumpTarget } from "./jump";
import { createReferencesStore } from "./references.svelte";
import { createSymbolsStore } from "./symbols.svelte";

export const NOTICE_MS = 5000;
export const NO_WORD_NOTICE = "Move the cursor onto a line of code first (j and k), or point at a word.";
export const OUTSIDE_REPO_NOTICE = "Definitions can only be followed from files in the repository, not from this file outside the repository.";
const REMOVED_SIDE_FALLBACK = "Navigating the removed side needs a language server that can read the old version.";

export interface LspDeps {
  files: () => DiffFile[];
  goToHit: (hit: SearchHit) => void;
  markJump: () => void; // remember the cursor before leaving it for the viewer
  // move the line cursor onto a clicked row (no jump recorded), so a jump from it remembers that row
  placeCursor?: (hit: CodeHit) => void;
  closeSearch: () => void; // the search docks share the strip under the top bar
  // where the reader is (cursor moves, file selection): a definition answer is stale once it changes
  stamp?: () => readonly unknown[];
}

export type Tone = "info" | "error";
export interface Notice { text: string; tone: Tone; seq: number }

export type ViewerState =
  | { status: "loading"; target: JumpTarget }
  | { status: "ready"; target: JumpTarget; content: string }
  | { status: "error"; target: JumpTarget; message: string };

const requestOf = (hit: CodeHit): LspPositionRequest => ({ path: hit.path, side: hit.side, line: hit.line, character: hit.token.start });

export function createLspStore(deps: LspDeps) {
  let notice = $state<Notice | null>(null);
  let noticeSeq = 0;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let picker = $state.raw<{ title: string; targets: LspTarget[]; selected: number } | null>(null);
  let viewer = $state.raw<ViewerState | null>(null);
  let removedSideHint = $state<string | null>(null); // set once the server says old-side navigation is off
  let pointed: CodeHit | null = null;
  let navigation: AbortController | undefined;
  let viewerLoad: AbortController | undefined;
  let trail: JumpTarget[] = []; // viewers the reader hopped away from, newest last

  function notify(text: string, tone: Tone = "info"): void {
    clearTimeout(noticeTimer);
    notice = { text, tone, seq: ++noticeSeq };
    noticeTimer = setTimeout(() => (notice = null), NOTICE_MS);
  }

  function fail(error: unknown): void {
    if (isAbort(error)) return;
    const lsp = lspErrorOf(error);
    if (lsp?.code === "cancelled") return;
    if (lsp?.code === "old-side-unsupported") removedSideHint = lsp.hint ?? REMOVED_SIDE_FALLBACK;
    notify(lspMessage(error), "error");
  }

  // a pending definition answer must not jump once anything else has navigated
  function cancelNavigation(): void {
    navigation?.abort();
    navigation = undefined;
  }

  // the same place: path-less targets compare by absolute path
  const sameTarget = (a: JumpTarget, b: JumpTarget): boolean => a.absolutePath === b.absolutePath && a.line === b.line && a.side === b.side;

  // `from` is the viewer this jump left: the hop goes on the trail, and the cursor was already
  // remembered when the viewer first opened. without it the reader is coming from the diff.
  function openViewer(target: JumpTarget, from: JumpTarget | null): Promise<void> {
    if (!from) {
      deps.markJump();
      trail = [];
    } else if (!sameTarget(from, target)) {
      trail = [...trail, from].slice(-JUMP_HISTORY_CAP);
    }
    return showViewer(target);
  }

  async function showViewer(target: JumpTarget): Promise<void> {
    cancelNavigation();
    viewerLoad?.abort();
    const controller = new AbortController();
    viewerLoad = controller;
    viewer = { status: "loading", target };
    try {
      const content = target.uri
        ? (await lspFile(target.uri, controller.signal)).content
        : target.path
          ? (await getFile(target.path, controller.signal)).content
          : null;
      if (viewerLoad !== controller) return;
      viewer = content === null ? { status: "error", target, message: "This file cannot be shown." } : { status: "ready", target, content };
    } catch (error) {
      if (viewerLoad !== controller || isAbort(error)) return;
      viewer = { status: "error", target, message: error instanceof Error ? error.message : "Could not read the file." };
    }
  }

  function closeViewer(): boolean {
    const wasOpen = viewer !== null;
    cancelNavigation(); // a late definition answer must not reopen what was just closed
    viewerLoad?.abort();
    viewer = null;
    trail = [];
    return wasOpen;
  }

  function jump(target: JumpTarget): void {
    cancelNavigation();
    viewerLoad?.abort();
    const from = viewer?.target ?? null;
    viewer = null;
    const landed = jumpTo({ files: deps.files, toDiff: deps.goToHit, toViewer: (t) => void openViewer(t, from) }, target);
    // the cursor history already holds where the reader started; viewer hops end where the diff begins
    if (landed === "diff") trail = [];
  }

  // Ctrl+o inside the viewer: one hop back along the trail. false when there is none, with the
  // viewer closed, so the caller carries on with the cursor's jump history.
  function viewerBack(): boolean {
    cancelNavigation();
    const previous = trail[trail.length - 1];
    if (!previous) {
      closeViewer();
      return false;
    }
    trail = trail.slice(0, -1);
    void showViewer(previous);
    return true;
  }

  // files no language server answers for: resting the pointer on them stops asking
  const silent = new Set<string>();
  const hover = createHoverStore({
    request: lspHover,
    canAsk: (hit) => !silent.has(hit.path) && !(hit.side === "old" && removedSideHint),
    onError: (error, explicit, hit) => {
      const code = lspErrorOf(error)?.code;
      if (code === "server-unavailable" && !explicit) silent.add(hit.path);
      if (code === "old-side-unsupported" || explicit) fail(error);
    },
  });

  const references = createReferencesStore({ request: lspReferences, jump, onError: fail });
  const symbols = createSymbolsStore({ document: lspDocumentSymbols, workspace: lspWorkspaceSymbols, jump, onError: fail });

  function openReferences(hit: CodeHit): void {
    cancelNavigation();
    hover.close();
    picker = null;
    symbols.close();
    deps.closeSearch();
    void references.start(requestOf(hit), hit.token.text);
  }

  async function definitionAt(hit: CodeHit, kind: LspDefinitionKind): Promise<void> {
    if (hit.side === "old" && removedSideHint) return notify(removedSideHint, "error");
    navigation?.abort();
    const controller = new AbortController();
    navigation = controller;
    const stamp = deps.stamp?.() ?? [];
    let response: LspDefinitionResponse;
    try {
      response = await lspDefinition(requestOf(hit), kind, controller.signal);
    } catch (error) {
      if (navigation === controller) fail(error);
      return;
    }
    if (navigation !== controller) return;
    navigation = undefined;
    // the reader moved (cursor, search hit, file pick) while the server was thinking
    if (!sameStamp(stamp, deps.stamp?.() ?? [])) return;
    // gd on a definition has nowhere to go; what the reader wants are its uses
    if (response.onDefinition && kind === "definition") return openReferences(hit);
    if (response.targets.length === 0) return notify(`No ${kind === "typeDefinition" ? "type definition" : "definition"} found for ${hit.token.text}.`);
    hover.close();
    if (response.targets.length === 1) return jump(targetOf(response.targets[0]!, response.targets[0]!.range));
    picker = { title: `${kind === "typeDefinition" ? "Type definitions" : "Definitions"} of ${hit.token.text}`, targets: response.targets, selected: 0 };
  }

  const atCursor = (): CodeHit | null => {
    if (viewer && !viewer.target.path) {
      notify(OUTSIDE_REPO_NOTICE);
      return null;
    }
    const hit = viewer ? viewerHit(pointed) : cursorHit(pointed);
    if (!hit) notify(NO_WORD_NOTICE);
    return hit;
  };

  return {
    hover,
    references,
    symbols,
    get notice(): Notice | null {
      return notice;
    },
    get picker() {
      return picker;
    },
    get viewer(): ViewerState | null {
      return viewer;
    },
    // set once the server refused the removed side; the diff pane shows a not-allowed cursor then
    get removedSideHint(): string | null {
      return removedSideHint;
    },
    notify,
    // the pointer rests on this word: `gd` and `gh` use it when it is on the cursor's line
    point(hit: CodeHit | null): void {
      pointed = hit;
    },

    definitionAtCursor(kind: LspDefinitionKind): void {
      const hit = atCursor();
      if (hit) void definitionAt(hit, kind);
    },
    // Ctrl/Cmd+click
    definitionAtHit(hit: CodeHit): void {
      // before the stamp is taken: the move bumps the cursor's reveal counter
      // (the viewer covers the diff: a click in it must not move the cursor underneath)
      if (!viewer) deps.placeCursor?.(hit);
      void definitionAt(hit, "definition");
    },
    hoverAtCursor(): void {
      const hit = atCursor();
      if (!hit) return;
      if (hit.side === "old" && removedSideHint) return notify(removedSideHint, "error");
      hover.showFor(hit);
    },
    referencesAtCursor(): void {
      const hit = atCursor();
      if (hit) openReferences(hit);
    },
    openDocumentSymbols(path: string | undefined): void {
      if (!path) return notify(NO_WORD_NOTICE);
      cancelNavigation();
      hover.close();
      picker = null;
      void symbols.openDocument(path);
    },
    openWorkspaceSymbols(): void {
      cancelNavigation();
      hover.close();
      picker = null;
      symbols.openWorkspace();
    },

    pickerMove(delta: number): void {
      if (picker) picker = { ...picker, selected: Math.max(0, Math.min(picker.targets.length - 1, picker.selected + delta)) };
    },
    pickerSelect(index: number): void {
      if (picker && index >= 0 && index < picker.targets.length) picker = { ...picker, selected: index };
    },
    pickerActivate(index?: number): void {
      if (!picker) return;
      const target = picker.targets[index ?? picker.selected];
      picker = null;
      if (target) jump(targetOf(target, target.range));
    },
    jump,
    viewerBack,
    cancelNavigation,
    // any code-navigation layer is open (Esc closes it before visual mode ends)
    get hasLayer(): boolean {
      return hover.card !== null || picker !== null || symbols.open || viewer !== null || references.open;
    },
    closeViewer,

    // Esc closes one layer, the one on top: hover card, picker, symbols, viewer, references.
    closeTopmost(): boolean {
      // a definition still in flight counts as a layer: Esc cancels it
      const pending = navigation !== undefined;
      cancelNavigation();
      if (hover.close()) return true;
      if (picker) {
        picker = null;
        return true;
      }
      if (symbols.close()) return true;
      if (closeViewer()) return true;
      return references.close() || pending;
    },
  };
}

export type LspStore = ReturnType<typeof createLspStore>;
