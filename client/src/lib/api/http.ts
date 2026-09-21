import type { ApiError } from "$types";

// reads the server's { error } envelope, falling back to the status when the body has none.
async function errorText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    if (body?.error) return body.error;
  } catch {
    // non-json error body — fall through to the status
  }
  return `request failed (${res.status})`;
}

// typed GET. throws Error(serverErrorText) on non-2xx; an abort signal cancels stale work.
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal });
  if (!res.ok) throw new Error(await errorText(res));
  return (await res.json()) as T;
}

// typed JSON POST, same error contract as apiGet.
export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(await errorText(res));
  return (await res.json()) as T;
}
