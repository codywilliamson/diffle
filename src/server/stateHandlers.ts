// /api/state — user-level state in ~/.loupe/state.json. carries the dismissed what's-new
// version across launches, since each launch's random port gives
// localStorage a fresh origin. these are the only handlers with no ServerContext to read.

import type { StateUpdateRequest, UserState } from "../types";
import { readUserState, writeUserState } from "../core/userState";
import { apiError, json } from "./respond";
import { providerFromEnv, resolveRadarMode } from "../radar/provider";

const RADAR_MODES = ["off", "local", "jev"] as const;

export function handleGetState(): Response {
  const state = readUserState();
  return json({ ...state, radarMode: resolveRadarMode(process.env, state.radarMode) });
}

export async function handlePostState(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid json body", 400);
  }
  const { seenVersion, radarMode } = body as StateUpdateRequest;
  const patch: UserState = {};
  if (typeof seenVersion === "string") patch.seenVersion = seenVersion;
  if (radarMode !== undefined) {
    if (!RADAR_MODES.includes(radarMode)) return apiError("radarMode must be off, local, or jev", 400);
    try { providerFromEnv(process.env, radarMode); }
    catch (error) { return apiError(error instanceof Error ? error.message : "Radar configuration failed", 400); }
    patch.radarMode = radarMode;
  }
  if (Object.keys(patch).length === 0) {
    return apiError("body must set seenVersion or radarMode", 400);
  }
  return json(writeUserState(patch));
}
