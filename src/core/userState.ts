// read/write <data dir>/state.json — user-level state that persists across launches. the
// what's-new modal lives here (not localStorage) because each launch picks a random port, and
// localStorage is scoped per origin (host:port) so it never carries over. this always resolves
// against the real home (not DIFFLE_DATA_DIR, which only relocates review records).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { UserState } from "../types";
import { homeDataDir } from "./dataDir";

const STATE_FILE = "state.json";

function statePath(home: string): string {
  return join(homeDataDir(home), STATE_FILE);
}

// reads ~/.loupe/state.json; empty state if absent or unparseable. home is injectable for tests.
export function readUserState(home = homedir()): UserState {
  const path = statePath(home);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as UserState;
  } catch {
    return {};
  }
}

// merges `patch` into the stored state and writes it back (creating the data dir as needed).
export function writeUserState(patch: UserState, home = homedir()): UserState {
  const next = { ...readUserState(home), ...patch };
  mkdirSync(homeDataDir(home), { recursive: true });
  writeFileSync(statePath(home), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
