// run a request with a deadline: past it the request is aborted and the promise rejects, so a
// hung server can't stall whatever waits behind it.

export const TIMEOUT_MESSAGE = "The server did not answer in time.";

export function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(TIMEOUT_MESSAGE));
    }, ms);
    run(controller.signal).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
