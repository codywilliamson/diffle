import type { ApiError } from "$types";

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

// typed GET. throws ApiRequestError (message = serverErrorText) on non-2xx; an abort signal cancels stale work.
export async function apiGet<T>(path: string, signal?: AbortSignal, headers?: HeadersInit): Promise<T> {
  const res = await fetch(path, { signal, headers });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

// typed JSON POST, same error contract as apiGet.
export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal, headers?: HeadersInit): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}
