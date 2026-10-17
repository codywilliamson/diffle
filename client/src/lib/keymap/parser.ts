// pure key parser: counts and chords as a state machine over (state, key, clock).
// no dom, no timers; the caller passes the time, so the chord timeout is testable.

import { BINDINGS, CHORD_TIMEOUT_MS, MAX_COUNT } from "./keymap";
import type { Binding, KeyInput, Mode, Outcome, ParserState } from "./types";

export const EMPTY_STATE: ParserState = { count: "", prefix: null, at: 0 };

const ESC = "Esc";
const NAMED_TOKEN = /^(Esc|Ctrl\+.)$/;

// "gg" -> ["g","g"]; "Ctrl+d" and "Esc" stay one token.
export function splitKeys(keys: string): string[] {
  return NAMED_TOKEN.test(keys) ? [keys] : [...keys];
}

// the keymap's name for a keyboard event, or null for keys it never binds (modified combos etc.).
export function tokenOf(input: KeyInput): string | null {
  if (input.alt || input.meta || (input.ctrl && input.shift)) return null;
  if (input.key === "Escape") return ESC;
  if (input.key.length !== 1) return null;
  return input.ctrl ? `Ctrl+${input.key.toLowerCase()}` : input.key;
}

const inMode = (binding: Binding, mode: Mode): boolean => binding.mode === mode || binding.mode === "any";
const isPending = (state: ParserState): boolean => state.count !== "" || state.prefix !== null;

function findBinding(table: Binding[], mode: Mode, tokens: string[]): Binding | undefined {
  return table.find((b) => {
    if (!inMode(b, mode)) return false;
    const keys = splitKeys(b.keys);
    return keys.length === tokens.length && keys.every((k, i) => k === tokens[i]);
  });
}

function isPrefix(table: Binding[], mode: Mode, token: string): boolean {
  return table.some((b) => inMode(b, mode) && splitKeys(b.keys).length > 1 && splitKeys(b.keys)[0] === token);
}

function countOf(state: ParserState, binding: Binding): number | null {
  if (!binding.count || state.count === "") return null;
  return Math.min(MAX_COUNT, Number(state.count));
}

export interface StepResult {
  state: ParserState;
  outcome: Outcome;
}

const result = (state: ParserState, outcome: Outcome): StepResult => ({ state, outcome });

export function step(
  previous: ParserState,
  input: KeyInput,
  mode: Mode,
  now: number,
  table: Binding[] = BINDINGS,
): StepResult {
  const token = tokenOf(input);
  // editable fields keep every key except Esc
  if (input.editable && token !== ESC) return result(previous, { kind: "ignored" });
  const state = isPending(previous) && now - previous.at > CHORD_TIMEOUT_MS ? EMPTY_STATE : previous;
  if (token === null) return result(state, { kind: "ignored" });

  if (token === ESC) {
    return result(EMPTY_STATE, { kind: isPending(state) ? "cancelled" : "escape" });
  }

  if (state.prefix !== null) {
    const binding = findBinding(table, mode, [state.prefix, token]);
    return result(EMPTY_STATE, binding ? { kind: "dispatch", binding, count: countOf(state, binding) } : { kind: "dropped" });
  }

  if (/^[0-9]$/.test(token)) {
    if (token === "0" && state.count === "") return result(state, { kind: "ignored" });
    const count = String(Math.min(MAX_COUNT, Number(state.count + token)));
    return result({ ...state, count, at: now }, { kind: "pending" });
  }

  if (isPrefix(table, mode, token)) return result({ count: state.count, prefix: token, at: now }, { kind: "pending" });

  const binding = findBinding(table, mode, [token]);
  if (binding) return result(EMPTY_STATE, { kind: "dispatch", binding, count: countOf(state, binding) });
  return result(EMPTY_STATE, { kind: state.count !== "" ? "dropped" : "ignored" });
}
