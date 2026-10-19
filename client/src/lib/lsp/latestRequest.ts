// "only the newest ask matters": a debounced request whose in-flight predecessor is aborted the
// moment a newer target arrives, and whose late answer is dropped even if the abort lost the race.
// hover and workspace symbols both run on it.

export interface LatestRequestOptions<A, R> {
  delayMs: number;
  run: (arg: A, signal: AbortSignal) => Promise<R>;
  onResult: (arg: A, result: R) => void;
  onError?: (arg: A, error: unknown) => void;
}

export interface LatestRequest<A> {
  schedule: (arg: A) => void; // after the debounce delay
  now: (arg: A) => void; // no delay (gh, Enter)
  cancel: () => void; // drop the pending timer and abort the request in flight
}

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

export function createLatestRequest<A, R>(options: LatestRequestOptions<A, R>): LatestRequest<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: AbortController | undefined;

  function cancel(): void {
    clearTimeout(timer);
    timer = undefined;
    inflight?.abort();
    inflight = undefined;
  }

  async function fire(arg: A): Promise<void> {
    cancel();
    const controller = new AbortController();
    inflight = controller;
    try {
      const result = await options.run(arg, controller.signal);
      if (inflight === controller && !controller.signal.aborted) options.onResult(arg, result);
    } catch (error) {
      if (inflight !== controller || controller.signal.aborted || isAbort(error)) return;
      options.onError?.(arg, error);
    } finally {
      if (inflight === controller) inflight = undefined;
    }
  }

  return {
    schedule(arg) {
      cancel();
      timer = setTimeout(() => void fire(arg), options.delayMs);
    },
    now: (arg) => void fire(arg),
    cancel,
  };
}
