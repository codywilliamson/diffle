import { describe, expect, test } from "bun:test";
import {
  keyFromInput,
  keysFromInput,
  reduceSelect,
  renderSelect,
  type SelectItem,
  type SelectState,
} from "../src/utils/multiSelect";

const state = (cursor: number, checked: boolean[]): SelectState => ({ cursor, checked });

describe("reduceSelect", () => {
  test("up and down wrap", () => {
    expect(reduceSelect(state(0, [false, false, false]), "up").cursor).toBe(2);
    expect(reduceSelect(state(2, [false, false, false]), "down").cursor).toBe(0);
    expect(reduceSelect(state(1, [false, false, false]), "down").cursor).toBe(2);
  });

  test("toggle flips only the cursor row", () => {
    expect(reduceSelect(state(1, [true, false, true]), "toggle").checked).toEqual([true, true, true]);
    expect(reduceSelect(state(0, [true, false]), "toggle").checked).toEqual([false, false]);
  });

  test("all checks everything unless already all checked", () => {
    expect(reduceSelect(state(0, [true, false]), "all").checked).toEqual([true, true]);
    expect(reduceSelect(state(0, [true, true]), "all").checked).toEqual([false, false]);
  });

  test("confirm, cancel and empty lists leave state alone", () => {
    const s = state(1, [true, false]);
    expect(reduceSelect(s, "confirm")).toEqual(s);
    expect(reduceSelect(s, "cancel")).toEqual(s);
    expect(reduceSelect(state(0, []), "down")).toEqual(state(0, []));
  });
});

describe("keyFromInput", () => {
  test.each([
    ["\x1b[A", "up"],
    ["k", "up"],
    ["\x1b[B", "down"],
    ["j", "down"],
    [" ", "toggle"],
    ["a", "all"],
    ["\r", "confirm"],
    ["\n", "confirm"],
    ["\x03", "cancel"],
    ["\x1b", "cancel"],
  ])("%j -> %s", (input, key) => {
    expect(keyFromInput(input)).toBe(key as ReturnType<typeof keyFromInput>);
  });

  test("ignores unknown input and other escape sequences", () => {
    expect(keyFromInput("x")).toBeUndefined();
    expect(keyFromInput("\x1b[C")).toBeUndefined();
  });
});

describe("keysFromInput", () => {
  test("splits a chunk holding several keypresses", () => {
    expect(keysFromInput("\x1b[B \x1bOAj\r")).toEqual(["down", "toggle", "up", "down", "confirm"]);
  });

  test("drops unmapped keys and sequences", () => {
    expect(keysFromInput("x\x1b[C")).toEqual([]);
  });

  test("a lone esc still cancels", () => {
    expect(keysFromInput("\x1b")).toEqual(["cancel"]);
  });
});

describe("renderSelect", () => {
  const items: SelectItem<string>[] = [
    { label: "Claude Code", hint: "(detected)", value: "claude", checked: true },
    { label: "Cursor", value: "cursor", checked: false },
  ];

  test("plain output marks the cursor row and checked state", () => {
    const lines = renderSelect("Select agents:", items, state(0, [true, false]), false).split("\n");
    expect(lines[0]).toBe("? Select agents:  (↑↓ move · space select · a all · enter confirm)");
    expect(lines[1]).toBe(" ❯ ● Claude Code  (detected)");
    expect(lines[2]).toBe("   ○ Cursor");
  });

  test("cursor marker follows state", () => {
    const lines = renderSelect("t", items, state(1, [true, true]), false).split("\n");
    expect(lines[1]).toBe("   ● Claude Code  (detected)");
    expect(lines[2]).toBe(" ❯ ● Cursor");
  });

  test("color adds ansi codes", () => {
    expect(renderSelect("t", items, state(0, [true, false]), true)).toContain("\x1b[");
    expect(renderSelect("t", items, state(0, [true, false]), false)).not.toContain("\x1b[");
  });
});
