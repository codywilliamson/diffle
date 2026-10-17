// tracks open browser tabs through a long-lived server-sent-events stream (GET /api/presence).
// a tab holds the stream open for as long as the page lives, background tabs included, so the
// connection count is a reliable "is anyone still looking" signal for `--wait`.

export interface Presence {
  count(): number;
  everConnected(): boolean;
  onChange(listener: () => void): () => void;
  add(): () => void; // registers one connection; returns its release function
}

const PING_INTERVAL_MS = 5_000; // under bun's 10s idle timeout
const RETRY_HINT_MS = 1_000;

export function createPresence(): Presence {
  let open = 0;
  let seen = false;
  const listeners = new Set<() => void>();
  const fire = () => { for (const listener of [...listeners]) listener(); };
  return {
    count: () => open,
    everConnected: () => seen,
    onChange(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    add() {
      open++; seen = true; fire();
      let released = false;
      return () => { if (released) return; released = true; open--; fire(); };
    },
  };
}

export function handlePresence(presence: Presence, req: Request): Response {
  const encoder = new TextEncoder();
  let release = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      release = presence.add();
      // a disconnect that lands before bun wires up stream cancellation still surfaces on the request signal.
      req.signal.addEventListener("abort", () => { clearInterval(ping); release(); }, { once: true });
      controller.enqueue(encoder.encode(`retry: ${RETRY_HINT_MS}\n: connected\n\n`));
      ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { clearInterval(ping); release(); }
      }, PING_INTERVAL_MS);
    },
    cancel() { clearInterval(ping); release(); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
  });
}
