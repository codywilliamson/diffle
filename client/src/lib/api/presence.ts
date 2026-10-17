// holds one server-sent-events stream open for the life of the page. the server counts open
// streams to tell `--wait` when the last tab has closed; nothing is read from it.
// closing on pagehide makes the disconnect immediate instead of waiting on the browser's teardown.

export function connectPresence(): EventSource | null {
  if (typeof EventSource === "undefined") return null;
  const source = new EventSource("/api/presence");
  window.addEventListener("pagehide", () => source.close(), { once: true });
  return source;
}
