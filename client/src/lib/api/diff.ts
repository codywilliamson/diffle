import type { ApiError, DiffResult } from "$types";

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

// GET /api/diff → the current DiffResult. throws Error(serverErrorText) on a non-2xx
// response so callers surface the exact server message; an abort signal cancels a stale refresh.
export async function getDiff(signal?: AbortSignal): Promise<DiffResult> {
  const res = await fetch("/api/diff", { signal });
  if (!res.ok) throw new Error(await errorText(res));
  return (await res.json()) as DiffResult;
}
