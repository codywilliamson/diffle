// holds one server-sent-events stream open for the life of the page. the server counts open
// streams to tell `--wait` when the last tab has closed; nothing is read from it.
// the stream closes on pagehide so a closed tab is seen at once, and reopens when the page comes
// back from the back/forward cache (which restores the page without rerunning main.ts).

import { reportReachable, reportUnreachable } from "./serverLink";

const PRESENCE_PATH = "/api/presence";

// the browser retries a dropped stream by itself, so its error and open events double as a free
// server-gone / server-back signal for the connection store.
function openStream(): EventSource {
  const source = new EventSource(PRESENCE_PATH);
  source.onerror = reportUnreachable;
  source.onopen = reportReachable;
  return source;
}

export function connectPresence(): EventSource | null {
  if (typeof EventSource === "undefined") return null;
  let source: EventSource | null = openStream();
  window.addEventListener("pagehide", () => { source?.close(); source = null; });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !source) source = openStream();
  });
  return source;
}
