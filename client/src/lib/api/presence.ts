// holds one server-sent-events stream open for the life of the page. the server counts open
// streams to tell `--wait` when the last tab has closed; nothing is read from it.
// the stream closes on pagehide so a closed tab is seen at once, and reopens when the page comes
// back from the back/forward cache (which restores the page without rerunning main.ts).

const PRESENCE_PATH = "/api/presence";

export function connectPresence(): EventSource | null {
  if (typeof EventSource === "undefined") return null;
  let source: EventSource | null = new EventSource(PRESENCE_PATH);
  window.addEventListener("pagehide", () => { source?.close(); source = null; });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !source) source = new EventSource(PRESENCE_PATH);
  });
  return source;
}
