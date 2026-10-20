import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffFile, LspDefinitionResponse, LspTarget } from "$types";
import { ApiRequestError } from "$lib/api/http";
import type { CodeHit } from "./domPosition";

const api = vi.hoisted(() => ({ lspDefinition: vi.fn(), lspFile: vi.fn(), getFile: vi.fn() }));
vi.mock("$lib/api/lsp", async (importOriginal) => ({ ...(await importOriginal<typeof import("$lib/api/lsp")>()), lspDefinition: api.lspDefinition, lspFile: api.lspFile }));
vi.mock("$lib/api/meta", () => ({ getFile: api.getFile }));

const { createLspStore, NOTICE_MS } = await import("./lsp.svelte");

const range = (line: number) => ({ start: { line, character: 4 }, end: { line, character: 9 } });
const target = (path: string | null, line: number, over: Partial<LspTarget> = {}): LspTarget => ({
  uri: `file:///r/${path ?? "ext/lib.d.ts"}`, path, absolutePath: `/r/${path ?? "ext/lib.d.ts"}`, inRepo: path !== null, inDiff: false, range: range(line), ...over,
});
const file = (path: string, newLines: number[]): DiffFile =>
  ({
    path, changeType: "modified", binary: false, additions: 1, deletions: 0,
    hunks: [{ header: "@@", lines: newLines.map((n) => ({ type: "addition", oldLine: null, newLine: n, content: "x" })) }],
  }) as unknown as DiffFile;

function hit(side: "old" | "new" = "new"): CodeHit {
  document.body.innerHTML = `<section data-file-path="src/main.ts"><span class="code-inner">greet(x)</span></section>`;
  return { path: "src/main.ts", side, line: 6, root: document.querySelector<HTMLElement>(".code-inner")!, token: { start: 0, end: 5, text: "greet" } };
}

function setup(files: DiffFile[] = [file("src/greeter.ts", [3, 4])], placeCursor?: (hit: CodeHit) => void) {
  const goToHit = vi.fn();
  const markJump = vi.fn();
  const closeSearch = vi.fn();
  const moved = { count: 0 }; // bumped by a test to stand for a cursor move, search jump or file pick
  const lsp = createLspStore({ files: () => files, goToHit, markJump, closeSearch, placeCursor, stamp: () => [moved.count] });
  return { lsp, goToHit, markJump, closeSearch, moved };
}

const answer = (targets: LspTarget[], onDefinition = false): LspDefinitionResponse => ({ targets, onDefinition });
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("lsp store: definition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.lspDefinition.mockReset();
    api.lspFile.mockReset();
    api.getFile.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("sends the word's start as a utf-16 position and the requested kind", async () => {
    const { lsp } = setup();
    api.lspDefinition.mockResolvedValue(answer([]));
    lsp.definitionAtHit(hit());
    await flush();
    expect(api.lspDefinition).toHaveBeenCalledWith({ path: "src/main.ts", side: "new", line: 6, character: 0 }, "definition", expect.any(AbortSignal));
  });

  it("Ctrl+click moves the cursor to the clicked row first, and its own answer is not stale", async () => {
    const order: string[] = [];
    const placed: CodeHit[] = [];
    const ctx = setup(undefined, (h) => {
      order.push("place");
      placed.push(h);
      ctx.moved.count++; // the real cursor bumps revealSeq on every move
    });
    ctx.goToHit.mockImplementation(() => order.push("jump"));
    api.lspDefinition.mockImplementation(async () => {
      order.push("ask");
      return answer([target("src/greeter.ts", 3, { inDiff: true })]);
    });
    const clicked = hit();
    ctx.lsp.definitionAtHit(clicked);
    await flush();
    expect(placed).toEqual([clicked]);
    expect(order).toEqual(["place", "ask", "jump"]);
  });

  it("one target inside the diff moves the cursor there", async () => {
    const { lsp, goToHit, markJump } = setup();
    api.lspDefinition.mockResolvedValue(answer([target("src/greeter.ts", 3, { inDiff: true })]));
    lsp.definitionAtHit(hit());
    await flush();
    expect(goToHit).toHaveBeenCalledWith({ path: "src/greeter.ts", side: "new", line: 3, preview: "", ranges: [] });
    expect(markJump).not.toHaveBeenCalled();
    expect(lsp.viewer).toBeNull();
  });

  it("a target in an unchanged repo file opens the viewer and records where the reader was", async () => {
    const { lsp, goToHit, markJump } = setup();
    api.lspDefinition.mockResolvedValue(answer([target("src/other.ts", 12)]));
    api.lspFile.mockResolvedValue({ content: "a\nb" });
    lsp.definitionAtHit(hit());
    await flush();
    expect(goToHit).not.toHaveBeenCalled();
    expect(markJump).toHaveBeenCalledOnce();
    expect(api.lspFile).toHaveBeenCalledWith("file:///r/src/other.ts", expect.any(AbortSignal));
    expect(lsp.viewer).toMatchObject({ status: "ready", target: { path: "src/other.ts", line: 12, inRepo: true } });
  });

  it("a target outside the repo opens the viewer with its absolute path", async () => {
    const { lsp } = setup();
    api.lspDefinition.mockResolvedValue(answer([target(null, 1)]));
    api.lspFile.mockResolvedValue({ content: "declare" });
    lsp.definitionAtHit(hit());
    await flush();
    expect(lsp.viewer?.target).toMatchObject({ path: null, inRepo: false, absolutePath: "/r/ext/lib.d.ts" });
  });

  it("several targets show a picker, and picking one jumps", async () => {
    const { lsp, goToHit } = setup();
    api.lspDefinition.mockResolvedValue(answer([target("src/other.ts", 2), target("src/greeter.ts", 4, { inDiff: true })]));
    lsp.definitionAtHit(hit());
    await flush();
    expect(lsp.picker?.targets).toHaveLength(2);
    lsp.pickerMove(1);
    lsp.pickerActivate();
    expect(lsp.picker).toBeNull();
    expect(goToHit).toHaveBeenCalledWith(expect.objectContaining({ path: "src/greeter.ts", line: 4 }));
  });

  it("gd on a definition opens references instead", async () => {
    const { lsp, closeSearch } = setup();
    const references = vi.spyOn(lsp.references, "start").mockResolvedValue();
    api.lspDefinition.mockResolvedValue(answer([target("src/greeter.ts", 2)], true));
    lsp.definitionAtHit(hit());
    await flush();
    expect(references).toHaveBeenCalledWith({ path: "src/main.ts", side: "new", line: 6, character: 0 }, "greet");
    expect(closeSearch).toHaveBeenCalled();
  });

  it("says so when nothing is found", async () => {
    const { lsp } = setup();
    api.lspDefinition.mockResolvedValue(answer([]));
    lsp.definitionAtHit(hit());
    await flush();
    expect(lsp.notice?.text).toBe("No definition found for greet.");
    await vi.advanceTimersByTimeAsync(NOTICE_MS);
    expect(lsp.notice).toBeNull();
  });

  it("shows the server's hint when no language server is ready", async () => {
    const { lsp } = setup();
    const body = { error: "typescript language server is missing", code: "server-unavailable", state: "missing", hint: "npm install -g typescript-language-server typescript" };
    api.lspDefinition.mockRejectedValue(new ApiRequestError(body.error, 409, body));
    lsp.definitionAtHit(hit());
    await flush();
    expect(lsp.notice).toMatchObject({ text: body.hint, tone: "error" });
  });

  it("removed side: shows the hint, then stops asking", async () => {
    const { lsp } = setup();
    const body = { error: "x", code: "old-side-unsupported", hint: "needs a detached worktree" };
    api.lspDefinition.mockRejectedValue(new ApiRequestError("x", 409, body));
    lsp.definitionAtHit(hit("old"));
    await flush();
    expect(lsp.notice?.text).toBe("needs a detached worktree");
    expect(lsp.removedSideHint).toBe("needs a detached worktree");
    lsp.definitionAtHit(hit("old"));
    await flush();
    expect(api.lspDefinition).toHaveBeenCalledOnce();
    // the new side is unaffected
    api.lspDefinition.mockResolvedValue(answer([]));
    lsp.definitionAtHit(hit("new"));
    await flush();
    expect(api.lspDefinition).toHaveBeenCalledTimes(2);
  });

  it("ignores the answer to a request a newer gd superseded", async () => {
    const { lsp, goToHit } = setup();
    let first!: (r: LspDefinitionResponse) => void;
    api.lspDefinition.mockImplementationOnce(() => new Promise((resolve) => (first = resolve)));
    api.lspDefinition.mockResolvedValueOnce(answer([target("src/greeter.ts", 4, { inDiff: true })]));
    lsp.definitionAtHit(hit());
    lsp.definitionAtHit(hit());
    await flush();
    first(answer([target("src/greeter.ts", 3, { inDiff: true })]));
    await flush();
    expect(goToHit).toHaveBeenCalledOnce();
    expect(goToHit).toHaveBeenCalledWith(expect.objectContaining({ line: 4 }));
  });

  it("a slow definition cannot jump after Ctrl+o, a reference jump or a viewer open", async () => {
    type Lsp = ReturnType<typeof setup>["lsp"];
    const viewerTarget = { path: null, absolutePath: "/x", uri: "file:///x", inRepo: false, line: 1, character: 0 };
    for (const supersede of [(lsp: Lsp) => lsp.cancelNavigation(), (lsp: Lsp) => lsp.jump(viewerTarget)]) {
      const { lsp, goToHit } = setup();
      api.lspFile.mockResolvedValue({ content: "x" });
      let slow!: (r: LspDefinitionResponse) => void;
      api.lspDefinition.mockImplementationOnce(() => new Promise((resolve) => (slow = resolve)));
      lsp.definitionAtHit(hit());
      await flush();
      supersede(lsp);
      slow(answer([target("src/greeter.ts", 3, { inDiff: true })]));
      await flush();
      expect(goToHit).not.toHaveBeenCalled();
    }
  });

  it("a slow definition is inert once the reader moved: search hit, keyboard move, file pick", async () => {
    const { lsp, goToHit, moved } = setup();
    api.lspFile.mockResolvedValue({ content: "x" });
    let slow!: (r: LspDefinitionResponse) => void;
    api.lspDefinition.mockImplementationOnce(() => new Promise((resolve) => (slow = resolve)));
    lsp.definitionAtHit(hit());
    await flush();
    moved.count++;
    slow(answer([target("src/greeter.ts", 3, { inDiff: true })]));
    await flush();
    expect(goToHit).not.toHaveBeenCalled();
    expect(lsp.viewer).toBeNull();
    expect(lsp.picker).toBeNull();
    expect(lsp.notice).toBeNull();
  });

  it("a definition that was not overtaken still jumps (its own jump does not cancel itself)", async () => {
    const { lsp, goToHit } = setup();
    api.lspDefinition.mockResolvedValue(answer([target("src/greeter.ts", 3, { inDiff: true })]));
    lsp.definitionAtHit(hit());
    await flush();
    expect(goToHit).toHaveBeenCalledOnce();
  });

  it("Esc cancels a pending definition even when it closes nothing, or only a panel", async () => {
    const { lsp, goToHit } = setup();
    api.lspFile.mockResolvedValue({ content: "x" });
    let slow!: (r: LspDefinitionResponse) => void;
    api.lspDefinition.mockImplementationOnce(() => new Promise((resolve) => (slow = resolve)));
    lsp.definitionAtHit(hit());
    await flush();
    expect(lsp.closeTopmost()).toBe(true);
    slow(answer([target("src/other.ts", 3)]));
    await flush();
    expect(goToHit).not.toHaveBeenCalled();
    expect(lsp.viewer).toBeNull();
    expect(lsp.closeTopmost()).toBe(false);
  });

  it("Esc with references open also cancels the pending definition", async () => {
    const { lsp } = setup();
    api.lspFile.mockResolvedValue({ content: "x" });
    vi.spyOn(lsp.references, "close").mockReturnValue(true);
    let slow!: (r: LspDefinitionResponse) => void;
    api.lspDefinition.mockImplementationOnce(() => new Promise((resolve) => (slow = resolve)));
    lsp.definitionAtHit(hit());
    await flush();
    lsp.closeTopmost();
    slow(answer([target("src/other.ts", 3)]));
    await flush();
    expect(lsp.viewer).toBeNull();
  });

  it("opening references drops a pending definition", async () => {
    const { lsp, goToHit } = setup();
    vi.spyOn(lsp.references, "start").mockResolvedValue();
    let slow!: (r: LspDefinitionResponse) => void;
    api.lspDefinition.mockImplementationOnce(() => new Promise((resolve) => (slow = resolve)));
    lsp.definitionAtHit(hit());
    await flush();
    document.body.innerHTML = `<table data-file-path="src/main.ts"><tr data-cursor><td><span class="code-inner" data-lsp-side="new" data-lsp-line="6">greet(x)</span></td></tr></table>`;
    lsp.referencesAtCursor();
    slow(answer([target("src/greeter.ts", 3, { inDiff: true })]));
    await flush();
    expect(goToHit).not.toHaveBeenCalled();
  });

  it("Esc closes one layer at a time, picker before viewer", async () => {
    const { lsp } = setup();
    api.lspDefinition.mockResolvedValue(answer([target("src/a.ts", 1), target("src/b.ts", 1)]));
    api.lspFile.mockResolvedValue({ content: "x" });
    lsp.definitionAtHit(hit());
    await flush();
    lsp.jump({ path: "src/a.ts", absolutePath: "/r/src/a.ts", uri: "file:///r/src/a.ts", inRepo: true, line: 1, character: 0 });
    await flush();
    expect(lsp.picker).not.toBeNull();
    expect(lsp.viewer).not.toBeNull();
    expect(lsp.closeTopmost()).toBe(true);
    expect([lsp.picker, lsp.viewer === null]).toEqual([null, false]);
    expect(lsp.closeTopmost()).toBe(true);
    expect(lsp.viewer).toBeNull();
    expect(lsp.closeTopmost()).toBe(false);
  });
});
