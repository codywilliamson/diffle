import { describe, expect, it, vi } from "vitest";
import type { DiffFile, DiffHunk, DiffLine } from "$types";
import type { AppState } from "$lib/state/context";
import { createCursorStore } from "$lib/state/cursor.svelte";
import { createFilePicker } from "$lib/state/filePicker.svelte";
import { createUiStore } from "$lib/state/ui.svelte";
import { pathInLine } from "$lib/diff/pathInLine";
import { createNavActions, NO_PATH_NOTICE, NO_RANGE_NOTICE } from "./navActions";
import { EMPTY_STATE, step } from "./parser";
import type { KeyInput, Mode, Outcome, ParserState } from "./types";

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k, ctrl: false, shift: false, alt: false, altGraph: false, meta: false, editable: false, ...extra,
});

function press(keys: (string | [string, Partial<KeyInput>])[], mode: Mode = "normal"): Outcome[] {
  let state: ParserState = EMPTY_STATE;
  return keys.map((k, i) => {
    const [name, extra] = typeof k === "string" ? [k, {}] : k;
    const result = step(state, key(name, extra), mode, i * 10);
    state = result.state;
    return result.outcome;
  });
}

const action = (o: Outcome | undefined): string | null => (o?.kind === "dispatch" ? o.binding.action : null);

describe("nav key dispatch", () => {
  it("binds gf, gv, the z folds and Ctrl+p", () => {
    expect(action(press(["g", "f"])[1])).toBe("file.goto");
    expect(action(press(["g", "v"])[1])).toBe("visual.reselect");
    expect(action(press(["z", "o"])[1])).toBe("fold.open");
    expect(action(press(["z", "c"])[1])).toBe("fold.close");
    expect(action(press(["z", "O"])[1])).toBe("fold.openAll");
    expect(action(press(["z", "C"])[1])).toBe("fold.closeAll");
    expect(action(press([["p", { ctrl: true }]])[0])).toBe("file.pick");
  });

  it("leaves the g chords that were already bound alone", () => {
    expect(action(press(["g", "g"])[1])).toBe("goto.top");
    expect(action(press(["g", "c"])[1])).toBe("review.scorecard");
    expect(action(press(["g", "d"])[1])).toBe("code.definition");
  });

  it("drops z followed by an unknown key and does not re-dispatch it", () => {
    const [, second] = press(["z", "j"]);
    expect(second!.kind).toBe("dropped");
  });

  it("does not take a plain p, and ignores Ctrl+p inside a field", () => {
    expect(press(["p"])[0]!.kind).toBe("ignored");
    expect(press([["p", { ctrl: true, editable: true }]])[0]!.kind).toBe("ignored");
  });

  it("gv is a normal-mode key: visual mode ignores it", () => {
    expect(press(["g", "v"], "visual")[1]!.kind).toBe("dropped");
  });
});

describe("pathInLine", () => {
  const files = ["src/app.ts", "src/lib/store.ts", "src/lib/util/index.ts", "docs/readme.md", "a/x.ts", "b/x.ts"];

  it("finds an exact path anywhere in the line", () => {
    expect(pathInLine('see "docs/readme.md" for more', "src/app.ts", files)).toEqual({ path: "docs/readme.md", line: null });
  });

  it("resolves relative imports, with and without an extension", () => {
    expect(pathInLine('import { s } from "./lib/store";', "src/app.ts", files)?.path).toBe("src/lib/store.ts");
    expect(pathInLine('import u from "./util";', "src/lib/store.ts", files)?.path).toBe("src/lib/util/index.ts");
    expect(pathInLine('import a from "../app.ts";', "src/lib/store.ts", files)?.path).toBe("src/app.ts");
  });

  it("reads a :line suffix", () => {
    expect(pathInLine("at src/app.ts:42:7", "x.ts", files)).toEqual({ path: "src/app.ts", line: 42 });
  });

  it("matches a path suffix only when it is unambiguous", () => {
    expect(pathInLine("lib/store.ts", "x.ts", files)?.path).toBe("src/lib/store.ts");
    expect(pathInLine("x.ts", "q.ts", files)).toBeNull();
  });

  it("returns null when nothing in the line is a diff file", () => {
    expect(pathInLine("const total = a.b + c;", "src/app.ts", files)).toBeNull();
    expect(pathInLine("", "src/app.ts", files)).toBeNull();
  });
});

describe("file picker", () => {
  it("ranks with the fuzzy matcher, moves, and jumps on activate", () => {
    const jump = vi.fn();
    const picker = createFilePicker({ files: () => ["src/app.ts", "src/keymap/keymap.ts", "README.md"], jump });
    expect(picker.rows).toEqual([]); // closed
    picker.show();
    expect(picker.rows.map((r) => r.path)).toEqual(["src/app.ts", "src/keymap/keymap.ts", "README.md"]);
    picker.setQuery("sk");
    expect(picker.rows.map((r) => r.path)).toEqual(["src/keymap/keymap.ts"]);
    picker.setQuery("src");
    picker.move(1);
    expect(picker.selected).toBe(1);
    picker.move(50);
    expect(picker.selected).toBe(1);
    picker.activate();
    expect(jump).toHaveBeenCalledWith("src/keymap/keymap.ts");
    expect(picker.open).toBe(false);
  });

  it("close reports whether it was open, and an empty result list activates nothing", () => {
    const jump = vi.fn();
    const picker = createFilePicker({ files: () => ["a.ts"], jump });
    expect(picker.close()).toBe(false);
    picker.show();
    picker.setQuery("zzz");
    picker.activate();
    expect(jump).not.toHaveBeenCalled();
    expect(picker.close()).toBe(true);
  });
});

const ctx = (n: number): DiffLine => ({ type: "context", oldLine: n, newLine: n, content: `c${n}` });
const hunk = (...lines: DiffLine[]): DiffHunk => ({ header: "@@", lines });
const file = (path: string, hunks: DiffHunk[]): DiffFile => ({ path, oldPath: null, changeType: "modified", additions: 0, deletions: 0, hunks });

function cursorOver(files: DiffFile[]) {
  let active: string | null = null;
  const open = vi.fn();
  const cursor = createCursorStore({ files: () => files, defaultSplit: () => false, activePath: () => active, follow: (p) => (active = p), open });
  return { cursor, open };
}

describe("cursor additions", () => {
  const A = file("a.ts", [hunk(ctx(1), ctx(2), ctx(3), ctx(4))]);
  const B = file("b.ts", [hunk(ctx(1), ctx(2))]);

  it("gv reselects the last range with the cursor at the end it was left on", () => {
    const { cursor } = cursorOver([A, B]);
    cursor.lines("a.ts", 1);
    cursor.startVisual("a.ts");
    cursor.lines("a.ts", 2);
    cursor.endVisual();
    cursor.lines("a.ts", 1);
    expect(cursor.visual).toBe(false);
    expect(cursor.reselectVisual()).toBe(true);
    expect(cursor.visual).toBe(true);
    expect(cursor.visualRange).toEqual({ path: "a.ts", side: "new", from: 1, to: 3 });
    expect(cursor.pos).toMatchObject({ line: 3 });
  });

  it("gv does nothing without an earlier range or while a range is open", () => {
    const { cursor } = cursorOver([A]);
    expect(cursor.reselectVisual()).toBe(false);
    cursor.lines("a.ts", 1);
    cursor.startVisual("a.ts");
    expect(cursor.reselectVisual()).toBe(false);
  });

  it("goToFile opens the file, parks on its header and records a jump", () => {
    const { cursor, open } = cursorOver([A, B]);
    cursor.lines("a.ts", 2);
    cursor.goToFile("b.ts");
    expect(open).toHaveBeenCalledWith("b.ts");
    expect(cursor.pos).toMatchObject({ path: "b.ts", line: 0 });
    cursor.back("a.ts");
    expect(cursor.pos).toMatchObject({ path: "a.ts", line: 2 });
    cursor.goToFile("missing.ts");
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("park rests on the header of the current file", () => {
    const { cursor } = cursorOver([A]);
    cursor.lines("a.ts", 2);
    cursor.park("a.ts");
    expect(cursor.pos).toEqual({ path: "a.ts", side: "new", line: 0 });
  });
});

describe("nav actions", () => {
  function setup(text: string | null) {
    const ui = createUiStore();
    const cursor = {
      lineText: () => text,
      goToFile: vi.fn(),
      goToHit: vi.fn(),
      park: vi.fn(),
      reselectVisual: vi.fn().mockReturnValue(false),
    };
    const lsp = { notify: vi.fn(), closeTopmost: vi.fn() };
    const filePicker = { show: vi.fn() };
    const diff = { files: [{ path: "src/a.ts" }, { path: "src/b.ts" }] };
    const actions = createNavActions({ ui, cursor, lsp, filePicker, diff } as unknown as AppState, () => "src/a.ts");
    return { ui, cursor, lsp, filePicker, actions };
  }

  it("gf jumps to a path on the line, with its line number when written", () => {
    const plain = setup('import "./b";');
    plain.actions["file.goto"](null);
    expect(plain.cursor.goToFile).toHaveBeenCalledWith("src/b.ts");
    const withLine = setup("see src/b.ts:12");
    withLine.actions["file.goto"](null);
    expect(withLine.cursor.goToHit).toHaveBeenCalledWith(expect.objectContaining({ path: "src/b.ts", line: 12, side: "new" }));
  });

  it("gf says so when the line names no changed file", () => {
    const h = setup("const x = 1;");
    h.actions["file.goto"](null);
    expect(h.lsp.notify).toHaveBeenCalledWith(NO_PATH_NOTICE);
    expect(h.cursor.goToFile).not.toHaveBeenCalled();
  });

  it("zc and zo fold the current file, zC and zO all of them", () => {
    const h = setup(null);
    h.actions["fold.close"](null);
    expect(h.ui.foldRequest).toMatchObject({ path: "src/a.ts", collapsed: true });
    expect(h.cursor.park).toHaveBeenCalledTimes(1);
    h.actions["fold.open"](null);
    expect(h.ui.foldRequest).toMatchObject({ path: "src/a.ts", collapsed: false });
    h.actions["fold.closeAll"](null);
    expect(h.ui.foldRequest).toMatchObject({ path: null, collapsed: true });
    h.actions["fold.openAll"](null);
    expect(h.ui.foldRequest).toMatchObject({ path: null, collapsed: false });
    expect(h.cursor.park).toHaveBeenCalledTimes(2);
  });

  it("each fold request is a new one, even when repeated", () => {
    const h = setup(null);
    h.actions["fold.openAll"](null);
    const first = h.ui.foldRequest!.seq;
    h.actions["fold.openAll"](null);
    expect(h.ui.foldRequest!.seq).toBeGreaterThan(first);
  });

  it("Ctrl+p opens the picker and gv reports when there is nothing to reselect", () => {
    const h = setup(null);
    h.actions["file.pick"](null);
    expect(h.filePicker.show).toHaveBeenCalled();
    h.actions["visual.reselect"](null);
    expect(h.lsp.notify).toHaveBeenCalledWith(NO_RANGE_NOTICE);
  });
});
