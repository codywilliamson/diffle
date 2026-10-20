// is the nittle server still there, and is it still this page's review? a network-level failure
// (not an HTTP error) only makes the link "suspect"; a probe after CONFIRM_DELAY_MS decides, so
// one blip never shows the banner. once "gone" it keeps probing. a server that answers must also
// be serving this page's review: a different one blocks writes ("mismatch") until the page is reloaded.

export const CONFIRM_DELAY_MS = 1500;
export const RECOVERY_INTERVAL_MS = 3000;
export const PROBE_TIMEOUT_MS = 2500;
const PROBE_PATH = "/api/review"; // no id: answers with the record this server was started for
const STATUS_NO_REVIEW = 400;
export const UNREADABLE_REVIEW = "unreadable";

const GONE_REASON = "The server is gone. Restart it to continue.";
const VERIFYING_REASON = "Checking that the server is still running this review…";
const MISMATCH_REASON = "A different review is running on this port. Reload to open it.";

export type LinkState = "online" | "suspect" | "gone" | "mismatch" | "verifying";

// null reviewId = the server has no durable review (legacy manual mode)
export type ProbeResult = { up: false } | { up: true; reviewId: string | null };

export interface ConnectionDeps {
  probe: () => Promise<ProbeResult>;
  pageReviewId: () => string | undefined;
  onRecover: () => void;
}

export async function probeServer(): Promise<ProbeResult> {
  try {
    const res = await fetch(PROBE_PATH, { cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (res.status === STATUS_NO_REVIEW) return { up: true, reviewId: null };
    if (!res.ok) return { up: true, reviewId: UNREADABLE_REVIEW };
    const body = (await res.json()) as { id?: unknown };
    return { up: true, reviewId: typeof body.id === "string" ? body.id : UNREADABLE_REVIEW };
  } catch {
    return { up: false };
  }
}

export function createConnectionStore(deps: ConnectionDeps) {
  let state = $state<LinkState>("online");
  let serverReviewId = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  // bumps whenever an in-flight probe stops mattering (a newer probe, recovery, dispose)
  let epoch = 0;
  let disposed = false;

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function schedule(ms: number): void {
    clearTimer();
    timer = setTimeout(() => void check(), ms);
  }

  async function check(): Promise<void> {
    clearTimer();
    const mine = ++epoch;
    const result = await deps.probe();
    if (disposed || mine !== epoch || state === "online") return;
    if (!result.up) {
      state = "gone";
    } else if (result.reviewId === (deps.pageReviewId() ?? null)) {
      return recover();
    } else {
      serverReviewId = result.reviewId;
      state = "mismatch";
    }
    schedule(RECOVERY_INTERVAL_MS);
  }

  function recover(): void {
    const reload = state !== "online" && state !== "suspect";
    state = "online";
    epoch++;
    clearTimer();
    if (reload) deps.onRecover();
  }

  return {
    get state(): LinkState {
      return state;
    },
    get gone(): boolean {
      return state === "gone";
    },
    get mismatch(): boolean {
      return state === "mismatch";
    },
    // why writes are off, or null while the server is there and serving this review.
    get blockedReason(): string | null {
      if (state === "gone") return GONE_REASON;
      if (state === "verifying") return VERIFYING_REASON;
      return state === "mismatch" ? MISMATCH_REASON : null;
    },
    // a page restored from the back/forward cache never saw the server change: block writes
    // until a probe confirms it is still this review.
    verify(): void {
      state = "verifying";
      void check();
    },
    // where to go to open the review the server on this port is actually running.
    get reloadUrl(): string {
      const id = serverReviewId;
      return id && id !== UNREADABLE_REVIEW ? `${location.pathname}?review=${encodeURIComponent(id)}` : location.pathname;
    },
    unreachable(): void {
      if (state !== "online") return;
      state = "suspect";
      schedule(CONFIRM_DELAY_MS);
    },
    // something answered. that alone never recovers: the probe must confirm it is the same review.
    reachable(): void {
      if (state !== "online") void check();
    },
    dispose(): void {
      disposed = true;
      epoch++;
      clearTimer();
    },
  };
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>;
