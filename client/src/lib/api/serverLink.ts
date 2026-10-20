// a tiny event bus between the fetch layer and the connection store. the fetch layer reports
// whether the server answered; it never decides what a failure means.

type LinkEvent = "unreachable" | "reachable";
type Listener = (event: LinkEvent) => void;

const listeners = new Set<Listener>();

export function onServerLink(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const emit = (event: LinkEvent): void => listeners.forEach((fn) => fn(event));

// the request never got an answer (connection refused or reset), as opposed to an HTTP error.
export const reportUnreachable = (): void => emit("unreachable");

// any HTTP answer, even a 4xx or 5xx, proves the server is there.
export const reportReachable = (): void => emit("reachable");
