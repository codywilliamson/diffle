// /api/state — user-level state in ~/.nittle/state.json. carries the dismissed what's-new
// version across launches, since each launch's random port gives
// localStorage a fresh origin. these are the only handlers with no ServerContext to read.

import type { StateUpdateRequest, UserState } from "../types";
import { readUserState, writeUserState } from "../core/userState";
import { apiError, json } from "./respond";

export function handleGetState(): Response {
  return json(readUserState());
}

export async function handlePostState(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid json body", 400);
  }
  const { seenVersion } = body as StateUpdateRequest;
  const patch: UserState = {};
  if (typeof seenVersion === "string") patch.seenVersion = seenVersion;
  if (Object.keys(patch).length === 0) {
    return apiError("body must set seenVersion (string)", 400);
  }
  return json(writeUserState(patch));
}
