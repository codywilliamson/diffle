// the references panel's state: one request for the word the panel was opened on, the result
// flattened into a keyboard list, and a cap on how many entries are drawn. the panel stays open
// after a jump so the next reference is a keypress away (like g/ search).

import type { LspPositionRequest, LspReference, LspReferenceFile, LspReferencesResponse } from "$types";
import { isAbort } from "$lib/api/lsp";
import { targetOf, type JumpTarget } from "./jump";

export const MAX_REFERENCES_SHOWN = 200;

export interface ReferenceItem {
  file: LspReferenceFile;
  reference: LspReference;
  index: number; // position in the flat list
}

export interface ReferenceGroup {
  file: LspReferenceFile;
  items: ReferenceItem[];
}

export interface ReferencesDeps {
  request: (request: LspPositionRequest, signal: AbortSignal) => Promise<LspReferencesResponse>;
  jump: (target: JumpTarget) => void;
  onError: (error: unknown) => void;
  cap?: number;
}

export type ReferencesStatus = "idle" | "loading" | "ready";

// keep whole entries up to the cap, file by file, in the server's order (diff files first)
export function capGroups(files: LspReferenceFile[], cap: number): { groups: ReferenceGroup[]; shown: number } {
  const groups: ReferenceGroup[] = [];
  let shown = 0;
  for (const file of files) {
    const room = cap - shown;
    if (room <= 0) break;
    const items = file.references.slice(0, room).map((reference) => ({ file, reference, index: shown++ }));
    if (items.length > 0) groups.push({ file, items });
  }
  return { groups, shown };
}

export function createReferencesStore(deps: ReferencesDeps) {
  let open = $state(false);
  let status = $state<ReferencesStatus>("idle");
  let word = $state("");
  let groups = $state.raw<ReferenceGroup[]>([]);
  let shown = $state(0);
  let total = $state(0);
  let selected = $state(0);
  let focusSeq = $state(0);
  let inflight: AbortController | undefined;

  const flat = (): ReferenceItem[] => groups.flatMap((g) => g.items);

  return {
    get open(): boolean {
      return open;
    },
    get status(): ReferencesStatus {
      return status;
    },
    get word(): string {
      return word;
    },
    get groups(): ReferenceGroup[] {
      return groups;
    },
    get shown(): number {
      return shown;
    },
    get total(): number {
      return total;
    },
    get truncated(): boolean {
      return shown < total;
    },
    get selected(): number {
      return selected;
    },
    get current(): ReferenceItem | undefined {
      return flat()[selected];
    },
    get focusSeq(): number {
      return focusSeq;
    },

    async start(request: LspPositionRequest, name: string): Promise<void> {
      inflight?.abort();
      const controller = new AbortController();
      inflight = controller;
      open = true;
      status = "loading";
      word = name;
      groups = [];
      shown = 0;
      total = 0;
      selected = 0;
      focusSeq++;
      try {
        const response = await deps.request(request, controller.signal);
        if (inflight !== controller) return;
        const capped = capGroups(response.files, deps.cap ?? MAX_REFERENCES_SHOWN);
        groups = capped.groups;
        shown = capped.shown;
        total = Math.max(response.total, capped.shown);
        status = "ready";
        focusSeq++;
      } catch (error) {
        if (inflight !== controller || isAbort(error)) return;
        open = false;
        status = "idle";
        deps.onError(error);
      }
    },
    move(delta: number): void {
      const count = flat().length;
      if (count > 0) selected = Math.max(0, Math.min(count - 1, selected + delta));
    },
    select(index: number): void {
      if (index >= 0 && index < flat().length) selected = index;
    },
    activate(index = selected): void {
      const item = flat()[index];
      if (!item) return;
      selected = index;
      deps.jump(targetOf(item.file, item.reference.range));
    },
    close(): boolean {
      const wasOpen = open;
      inflight?.abort();
      inflight = undefined;
      open = false;
      status = "idle";
      return wasOpen;
    },
  };
}

export type ReferencesStore = ReturnType<typeof createReferencesStore>;
