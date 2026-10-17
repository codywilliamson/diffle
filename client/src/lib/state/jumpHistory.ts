// vim-style jump list as immutable functions. a jump records where you were; Ctrl+o walks back
// and Ctrl+i forward. any new jump drops the forward entries.

import { JUMP_HISTORY_CAP } from "$lib/keymap/keymap";
import { samePos, type CursorPos } from "./cursorSteps";

export interface JumpHistory {
  back: CursorPos[];
  forward: CursorPos[];
}

export const EMPTY_HISTORY: JumpHistory = { back: [], forward: [] };

export function recordJump(history: JumpHistory, from: CursorPos | null): JumpHistory {
  if (!from || samePos(history.back[history.back.length - 1] ?? null, from)) return { back: history.back, forward: [] };
  return { back: [...history.back, from].slice(-JUMP_HISTORY_CAP), forward: [] };
}

export interface JumpStep {
  history: JumpHistory;
  target: CursorPos | null;
}

export function jumpBack(history: JumpHistory, current: CursorPos | null): JumpStep {
  const target = history.back[history.back.length - 1];
  if (!target) return { history, target: null };
  const forward = current ? [...history.forward, current] : history.forward;
  return { history: { back: history.back.slice(0, -1), forward }, target };
}

export function jumpForward(history: JumpHistory, current: CursorPos | null): JumpStep {
  const target = history.forward[history.forward.length - 1];
  if (!target) return { history, target: null };
  const back = current ? [...history.back, current].slice(-JUMP_HISTORY_CAP) : history.back;
  return { history: { back, forward: history.forward.slice(0, -1) }, target };
}
