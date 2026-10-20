import type { ApiError } from "$types";
import { mutationBlockedReason, reportReachable, reportUnreachable } from "./serverLink";

// a non-2xx answer. message is the server's { error } text; body keeps the whole envelope for
// callers that read more of it (the lsp routes add code, state and hint).
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function failure(res: Response): Promise<ApiRequestError> {
  try {
    const body = (await res.json()) as ApiError;
    if (body?.error) return new ApiRequestError(body.error, res.status, body);
  } catch {
    // non-json error body — fall through to the status
  }
  return new ApiRequestError(`request failed (${res.status})`, res.status, null);
}

// fetch that tells the connection store whether the server answered. an abort is ours, not a failure.
async function send(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) reportUnreachable();
    throw err;
  }
  reportReachable();
  return res;
}

// typed GET. throws ApiRequestError (message = serverErrorText) on non-2xx; an abort signal cancels stale work.
export async function apiGet<T>(path: string, signal?: AbortSignal, headers?: HeadersInit): Promise<T> {
  const res = await send(path, { signal, headers });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

// typed JSON POST, same error contract as apiGet. keepalive lets the request outlive the page (unload flushes; body under 64KB).
export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal, headers?: HeadersInit, keepalive = false): Promise<T> {
  const blocked = mutationBlockedReason();
  if (blocked) throw new Error(blocked);
  const res = await send(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
    keepalive,
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}
