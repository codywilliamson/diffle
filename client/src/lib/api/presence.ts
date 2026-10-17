// holds one server-sent-events stream open for the life of the page. the server counts open
// streams to tell `--wait` when the last tab has closed; nothing is read from it.

export function connectPresence(): void {
  if (typeof EventSource === "undefined") return;
  new EventSource("/api/presence");
}
