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

// one guard for every POST, so buttons and keyboard actions are covered alike. the connection
// store installs a reason while the server is unusable; apiPost refuses before touching the network.
let blockedReason: () => string | null = () => null;

export function setMutationBlock(reason: () => string | null): void {
  blockedReason = reason;
}

export const mutationBlockedReason = (): string | null => blockedReason();
