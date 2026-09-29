// dependency-free checkbox prompt (space toggles, enter confirms). callers handle the non-tty case.

import { PRODUCT } from "../core/product";

export interface SelectItem<T> {
  label: string;
  hint?: string; // dim suffix in the list, left out of the summary
  value: T;
  checked: boolean;
}
export interface SelectState {
  cursor: number;
  checked: boolean[];
}
export type SelectKey = "up" | "down" | "toggle" | "all" | "confirm" | "cancel";

const HINT = "(↑↓ move · space select · a all · enter confirm)";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

export function reduceSelect(state: SelectState, key: SelectKey): SelectState {
  const count = state.checked.length;
  if (count === 0) return state;
  switch (key) {
    case "up":
      return { ...state, cursor: (state.cursor - 1 + count) % count };
    case "down":
      return { ...state, cursor: (state.cursor + 1) % count };
    case "toggle":
      return { ...state, checked: state.checked.map((c, i) => (i === state.cursor ? !c : c)) };
    case "all": {
      const next = !state.checked.every(Boolean);
      return { ...state, checked: state.checked.map(() => next) };
    }
    default:
      return state;
  }
}

export function keyFromInput(data: string): SelectKey | undefined {
  switch (data) {
    case "\x1b[A":
    case "\x1bOA":
    case "k":
      return "up";
    case "\x1b[B":
    case "\x1bOB":
    case "j":
      return "down";
    case " ":
      return "toggle";
    case "a":
      return "all";
    case "\r":
    case "\n":
      return "confirm";
    case "\x03":
    case "\x1b":
      return "cancel";
    default:
      return undefined;
  }
}

// a chunk can hold several keypresses (fast typing, paste): split escape sequences from single chars
const KEY_TOKEN = /\x1b(?:\[|O)[A-Z]|[\s\S]/g;

export function keysFromInput(data: string): SelectKey[] {
  return (data.match(KEY_TOKEN) ?? []).map(keyFromInput).filter((key): key is SelectKey => key !== undefined);
}

const paint = (on: boolean, code: string) => (s: string) => (on ? `\x1b[${code}m${s}\x1b[0m` : s);

export function renderSelect<T>(
  title: string,
  items: SelectItem<T>[],
  state: SelectState,
  color: boolean,
): string {
  const accent = paint(color, PRODUCT.accent);
  const bold = paint(color, "1");
  const dim = paint(color, "2");
  const rows = items.map((item, i) => {
    const on = i === state.cursor;
    const mark = state.checked[i] ? accent("●") : dim("○");
    const label = (on ? bold(item.label) : item.label) + (item.hint ? `  ${dim(item.hint)}` : "");
    return `${on ? accent("❯") : " "} ${mark} ${label}`;
  });
  return [`${accent("?")} ${bold(title)}  ${dim(HINT)}`, ...rows.map((r) => ` ${r}`)].join("\n");
}

function summaryLine<T>(title: string, items: SelectItem<T>[], checked: boolean[], color: boolean) {
  const names = items.filter((_, i) => checked[i]).map((item) => item.label);
  return `${paint(color, PRODUCT.accent)("?")} ${paint(color, "1")(title)} ${names.join(", ")}`;
}

export async function promptMultiSelect<T>(
  title: string,
  items: SelectItem<T>[],
): Promise<T[] | undefined> {
  const stdin = process.stdin;
  if (stdin.isTTY !== true) throw new Error("interactive selection needs a tty");
  const color = process.stdout.isTTY === true;
  const out = (s: string) => process.stdout.write(s);
  let state: SelectState = { cursor: 0, checked: items.map((i) => i.checked) };
  let lines = 0;

  const draw = () => {
    const text = renderSelect(title, items, state, color);
    out(`${lines > 0 ? `\x1b[${lines}F` : ""}\x1b[J${text}\n`);
    lines = text.split("\n").length;
  };

  return new Promise((resolve) => {
    const finish = (result: T[] | undefined, final: string) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      out(`${lines > 0 ? `\x1b[${lines}F` : ""}\x1b[J${final ? `${final}\n` : ""}${SHOW_CURSOR}`);
      resolve(result);
    };
    const onData = (chunk: Buffer | string) => {
      const keys = keysFromInput(chunk.toString());
      if (keys.length === 0) return;
      for (const key of keys) {
        if (key === "cancel") return finish(undefined, "");
        if (key === "confirm") {
          const values = items.filter((_, i) => state.checked[i]).map((i) => i.value);
          return finish(values, summaryLine(title, items, state.checked, color));
        }
        state = reduceSelect(state, key);
      }
      draw();
    };
    try {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on("data", onData);
      out(HIDE_CURSOR);
      draw();
    } catch (err) {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      out(SHOW_CURSOR);
      throw err;
    }
  });
}
