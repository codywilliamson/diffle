// read/write the Loupe data directory's state.json — user-level state across launches.
// the what's-new modal lives here (not localStorage) because each launch picks a random
// port, and localStorage is scoped per origin (host:port) so it never carries over.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { UserState } from "../types";
import { dataDir } from "./dataDir";

const STATE_FILE = "state.json";

function statePath(root: string): string {
  return join(root, STATE_FILE);
}

// empty state if absent or unparseable. root is injectable for tests.
export function readUserState(root = dataDir()): UserState {
  const path = statePath(root);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as UserState;
  } catch {
    return {};
  }
}

// merges `patch` into the stored state and writes it back (creating ~/.loupe as needed).
export function writeUserState(patch: UserState, root = dataDir()): UserState {
  const next = { ...readUserState(root), ...patch };
  mkdirSync(root, { recursive: true });
  writeFileSync(statePath(root), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
