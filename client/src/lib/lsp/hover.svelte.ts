// hover docs. the pointer resting on a word (or `gh` on the cursor's word) asks the server and
// shows the answer in a card. one request at a time: moving to another word aborts the one in
// flight and drops its card, so a stale answer never sits next to the wrong word. the card
// survives the pointer leaving the word for up to HOVER_GRACE_MS, which is the time it takes to
// cross onto the card; while the pointer is on the card it stays.

import type { LspHoverResponse, LspPositionRequest } from "$types";
import { createLatestRequest } from "./latestRequest";
import { rangeFor, type CodeHit } from "./domPosition";

export const HOVER_DWELL_MS = 450;
export const HOVER_GRACE_MS = 250;

export interface HoverCard {
  contents: string; // markdown
  key: string;
  anchor: { left: number; top: number; bottom: number; right: number }; // the word, in viewport px
}

export interface HoverDeps {
  request: (request: LspPositionRequest, signal: AbortSignal) => Promise<LspHoverResponse>;
  onError?: (error: unknown, explicit: boolean, hit: CodeHit) => void;
  // false for words not worth a request while the pointer idles over them (a file no server covers)
  canAsk?: (hit: CodeHit) => boolean;
  dwellMs?: number;
  graceMs?: number;
}

const keyOf = (hit: CodeHit): string => `${hit.path}:${hit.side}:${hit.line}:${hit.token.start}`;

function anchorOf(hit: CodeHit): HoverCard["anchor"] | null {
  if (!hit.root.isConnected) return null;
  const range = rangeFor(hit.root, hit.token.start, hit.token.end);
  if (!range) return null;
  const box = range.getBoundingClientRect?.() ?? { left: 0, top: 0, bottom: 0, right: 0 }; // jsdom has no layout
  return { left: box.left, top: box.top, bottom: box.bottom, right: box.right };
}

export function createHoverStore(deps: HoverDeps) {
  let card = $state.raw<HoverCard | null>(null);
  let target: string | null = null; // the word the card, or the request in flight, is for
  let explicit = false;
  let overCard = false;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;

  const latest = createLatestRequest<CodeHit, LspHoverResponse>({
    delayMs: deps.dwellMs ?? HOVER_DWELL_MS,
    run: (hit, signal) => deps.request({ path: hit.path, side: hit.side, line: hit.line, character: hit.token.start }, signal),
    onResult: (hit, response) => {
      const anchor = anchorOf(hit);
      if (!response.contents.trim() || !anchor) return;
      card = { contents: response.contents, key: keyOf(hit), anchor };
    },
    onError: (hit, error) => deps.onError?.(error, explicit, hit),
  });

  function cancelGrace(): void {
    clearTimeout(graceTimer);
    graceTimer = undefined;
  }

  function close(): boolean {
    const wasOpen = card !== null;
    latest.cancel();
    cancelGrace();
    card = null;
    target = null;
    overCard = false;
    return wasOpen;
  }

  function retarget(hit: CodeHit): void {
    latest.cancel();
    cancelGrace();
    card = null;
    target = keyOf(hit);
  }

  return {
    get card(): HoverCard | null {
      return card;
    },
    // the pointer is over a word (or over nothing: null). called on every move, cheap when unchanged.
    pointerOver(candidate: CodeHit | null): void {
      if (overCard) return;
      const hit = candidate && (deps.canAsk?.(candidate) ?? true) ? candidate : null;
      if (!hit) {
        if (target === null || graceTimer) return;
        graceTimer = setTimeout(close, deps.graceMs ?? HOVER_GRACE_MS);
        return;
      }
      const key = keyOf(hit);
      if (key === target) return cancelGrace();
      explicit = false;
      retarget(hit);
      latest.schedule(hit);
    },
    // gh: no dwell, and errors are worth telling the reader about
    showFor(hit: CodeHit): void {
      explicit = true;
      retarget(hit);
      latest.now(hit);
    },
    cardEnter(): void {
      overCard = true;
      cancelGrace();
    },
    cardLeave(): void {
      overCard = false;
      graceTimer = setTimeout(close, deps.graceMs ?? HOVER_GRACE_MS);
    },
    close,
  };
}

export type HoverStore = ReturnType<typeof createHoverStore>;
