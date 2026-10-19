// the symbol picker's state. `gs` outlines the current file (one request, filtered on the
// client); `gS` searches the repository (every keystroke is debounced into one request, and a
// newer query aborts the older one).

import type { LspDocumentSymbolsResponse, LspWorkspaceSymbolsResponse } from "$types";
import { isAbort } from "$lib/api/lsp";
import { createLatestRequest } from "./latestRequest";
import type { JumpTarget } from "./jump";
import { documentRows, visibleRows, workspaceRows, type SymbolRow } from "./symbolRows";

export const SYMBOL_DEBOUNCE_MS = 200;

export type SymbolScope = "document" | "workspace";
export type SymbolsStatus = "idle" | "loading" | "ready" | "error";

export interface SymbolsDeps {
  document: (path: string, signal: AbortSignal) => Promise<LspDocumentSymbolsResponse>;
  workspace: (query: string, signal: AbortSignal) => Promise<LspWorkspaceSymbolsResponse>;
  jump: (target: JumpTarget) => void;
  onError: (error: unknown) => void;
  debounceMs?: number;
}

export function createSymbolsStore(deps: SymbolsDeps) {
  let open = $state(false);
  let scope = $state<SymbolScope>("document");
  let status = $state<SymbolsStatus>("idle");
  let path = $state<string | null>(null);
  let query = $state("");
  let rows = $state.raw<SymbolRow[]>([]);
  let selected = $state(0);
  let total = $state(0);
  let truncated = $state(false);
  let focusSeq = $state(0);
  let docLoad: AbortController | undefined;

  const visible = $derived(visibleRows(rows, query, scope === "workspace"));

  const workspace = createLatestRequest<string, LspWorkspaceSymbolsResponse>({
    delayMs: deps.debounceMs ?? SYMBOL_DEBOUNCE_MS,
    run: (text, signal) => deps.workspace(text, signal),
    onResult: (_text, response) => {
      rows = workspaceRows(response.symbols);
      total = response.total;
      truncated = response.truncated;
      selected = 0;
      status = "ready";
    },
    onError: (error) => {
      status = "error";
      deps.onError(error);
    },
  });

  function reset(next: SymbolScope): void {
    workspace.cancel();
    docLoad?.abort();
    scope = next;
    open = true;
    query = "";
    rows = [];
    selected = 0;
    total = 0;
    truncated = false;
    status = "loading";
    focusSeq++;
  }

  function close(): boolean {
    const wasOpen = open;
    workspace.cancel();
    docLoad?.abort();
    docLoad = undefined;
    open = false;
    status = "idle";
    return wasOpen;
  }

  return {
    get open(): boolean {
      return open;
    },
    get scope(): SymbolScope {
      return scope;
    },
    get status(): SymbolsStatus {
      return status;
    },
    get path(): string | null {
      return path;
    },
    get query(): string {
      return query;
    },
    get rows(): SymbolRow[] {
      return visible;
    },
    get selected(): number {
      return selected;
    },
    get total(): number {
      return total;
    },
    get truncated(): boolean {
      return truncated;
    },
    get focusSeq(): number {
      return focusSeq;
    },

    async openDocument(file: string): Promise<void> {
      reset("document");
      path = file;
      const controller = new AbortController();
      docLoad = controller;
      try {
        const response = await deps.document(file, controller.signal);
        if (docLoad !== controller) return;
        rows = documentRows(response.path, response.symbols);
        status = "ready";
      } catch (error) {
        if (docLoad !== controller || isAbort(error)) return;
        open = false;
        status = "error";
        deps.onError(error);
      }
    },
    openWorkspace(): void {
      reset("workspace");
      path = null;
      workspace.now("");
    },
    setQuery(next: string): void {
      query = next;
      selected = 0;
      if (scope === "workspace") {
        status = "loading";
        workspace.schedule(next);
      }
    },
    move(delta: number): void {
      if (visible.length > 0) selected = Math.max(0, Math.min(visible.length - 1, selected + delta));
    },
    select(index: number): void {
      if (index >= 0 && index < visible.length) selected = index;
    },
    // Enter: close the picker and jump
    activate(index = selected): void {
      const row = visible[index];
      if (!row) return;
      close();
      deps.jump(row.target);
    },
    close,
  };
}

export type SymbolsStore = ReturnType<typeof createSymbolsStore>;
