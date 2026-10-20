// holding a key fires keydown over and over. only plain motions may ride that: a held d would
// complete dd and keep deleting, a held z would keep folding.

import type { ActionId, Outcome } from "./types";

export const REPEATABLE_ACTIONS: ReadonlySet<ActionId> = new Set<ActionId>([
  "line.next", "line.prev", "file.next", "file.prev", "hunk.next", "hunk.prev", "page.down", "page.up",
]);

// a repeated keydown is dropped unless it is a motion (or was never the keymap's)
export function repeatAllowed(outcome: Outcome): boolean {
  if (outcome.kind === "ignored") return true;
  return outcome.kind === "dispatch" && REPEATABLE_ACTIONS.has(outcome.binding.action);
}
