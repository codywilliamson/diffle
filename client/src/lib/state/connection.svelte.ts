// is the nittle server still there? a network-level failure (not an HTTP error) only makes the
// link "suspect"; a probe after CONFIRM_DELAY_MS decides, so one blip never flashes the banner.
// once "gone" it keeps probing and recovers on its own when the server answers again.

export const CONFIRM_DELAY_MS = 1500;
export const RECOVERY_INTERVAL_MS = 3000;
export const PROBE_TIMEOUT_MS = 2500;
const PROBE_PATH = "/api/state";

const GONE_REASON = "The server is gone. Restart it to continue.";

export type LinkState = "online" | "suspect" | "gone";

export interface ConnectionDeps {
  // true when the server answered with anything at all.
  probe: () => Promise<boolean>;
  onRecover: () => void;
}

export async function probeServer(): Promise<boolean> {
  try {
    await fetch(PROBE_PATH, { cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

export function createConnectionStore(deps: ConnectionDeps) {
  let state = $state<LinkState>("online");
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function schedule(ms: number): void {
    clearTimer();
    timer = setTimeout(() => void check(), ms);
  }

  async function check(): Promise<void> {
    timer = null;
    const up = await deps.probe();
    if (state === "online") return;
    if (up) return reachable();
    state = "gone";
    schedule(RECOVERY_INTERVAL_MS);
  }

  function reachable(): void {
    if (state === "online") return;
    const wasGone = state === "gone";
    state = "online";
    clearTimer();
    if (wasGone) deps.onRecover();
  }

  function unreachable(): void {
    if (state !== "online") return;
    state = "suspect";
    schedule(CONFIRM_DELAY_MS);
  }

  return {
    get state(): LinkState {
      return state;
    },
    get gone(): boolean {
      return state === "gone";
    },
    // why server-backed actions are off, or null while the server is there.
    get blockedReason(): string | null {
      return state === "gone" ? GONE_REASON : null;
    },
    unreachable,
    reachable,
    dispose: clearTimer,
  };
}

export type ConnectionStore = ReturnType<typeof createConnectionStore>;
