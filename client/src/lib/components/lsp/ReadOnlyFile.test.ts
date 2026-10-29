import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DiffFile, LspDefinitionResponse, LspTarget } from "$types";

const api = vi.hoisted(() => ({ lspDefinition: vi.fn(), lspFile: vi.fn(), getFile: vi.fn() }));
vi.mock("$lib/api/lsp", async (importOriginal) => ({ ...(await importOriginal<typeof import("$lib/api/lsp")>()), lspDefinition: api.lspDefinition, lspFile: api.lspFile }));
vi.mock("$lib/api/meta", () => ({ getFile: api.getFile }));
vi.mock("$lib/lsp/highlightCode", () => ({ highlightText: async () => null }));
const appState = vi.hoisted(() => ({ lsp: null as unknown }));
vi.mock("$lib/state/context", () => ({ getAppState: () => appState }));

const { createLspStore } = await import("$lib/lsp/lsp.svelte");
const { default: ReadOnlyFile } = await import("./ReadOnlyFile.svelte");
const { lspPointer } = await import("$lib/lsp/pointer");
const { hitInRow } = await import("$lib/lsp/domPosition");

const ENV = 'import { NAME } from "./name";\nexport const PRODUCT = NAME;\n';
const NAME_TS = 'export const NAME = "nittle";\n';
const range = (line: number, character: number) => ({ start: { line, character }, end: { line, character: character + 4 } });
const location = (path: string, line: number, character: number, over: Partial<LspTarget> = {}): LspTarget => ({
  uri: `file:///r/${path}`, path, absolutePath: `/r/${path}`, inRepo: true, inDiff: false, range: range(line, character), ...over,
});
const answer = (targets: LspTarget[]): LspDefinitionResponse => ({ targets, onDefinition: false });

function mountViewer(files: DiffFile[] = []) {
  const markJump = vi.fn();
  const lsp = createLspStore({ files: () => files, goToHit: vi.fn(), markJump, closeSearch: vi.fn() });
  appState.lsp = lsp;
  const view = render(ReadOnlyFile);
  return { lsp, markJump, ...view };
}

const section = () => document.querySelector<HTMLElement>("[data-lsp-viewer]")!;
const typeKeys = async (...keys: string[]) => {
  for (const key of keys) await fireEvent.keyDown(section(), { key });
};

const scrollTo = vi.fn();
beforeEach(() => {
  scrollTo.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"];
  api.lspDefinition.mockReset();
  api.lspFile.mockReset();
  api.getFile.mockReset();
  api.getFile.mockImplementation(async (path: string) => ({ content: path === "src/env.ts" ? ENV : NAME_TS }));
});
afterEach(() => vi.restoreAllMocks());

describe("read-only viewer navigation", () => {
  it("gd on the target line asks for the definition of its first word and shows the answer", async () => {
    const { lsp } = mountViewer();
    lsp.jump({ path: "src/env.ts", absolutePath: "/r/src/env.ts", inRepo: true, line: 2, character: 13 });
    await screen.findByText(/PRODUCT/);
    api.lspDefinition.mockResolvedValue(answer([location("src/name.ts", 1, 13)]));

    await typeKeys("g", "d");

    await waitFor(() => expect(section().getAttribute("aria-label")).toBe("Read-only file src/name.ts"));
    expect(api.lspDefinition).toHaveBeenCalledWith({ path: "src/env.ts", side: "new", line: 2, character: 13 }, "definition", expect.any(AbortSignal));
  });

  it("asks on the old side when the viewer shows the base commit's file", async () => {
    const { lsp } = mountViewer();
    api.lspFile.mockResolvedValue({ content: ENV });
    lsp.jump({ path: "src/env.ts", absolutePath: "/base/src/env.ts", uri: "file:///base/src/env.ts", inRepo: true, side: "old", line: 2, character: 13 });
    await screen.findByText(/PRODUCT/);
    api.lspDefinition.mockResolvedValue(answer([]));

    await typeKeys("g", "d");

    await waitFor(() => expect(api.lspDefinition).toHaveBeenCalled());
    expect(api.lspDefinition.mock.calls[0]![0]).toMatchObject({ path: "src/env.ts", side: "old" });
  });

  it("Ctrl+click on a word in the viewer follows it, and Ctrl+o walks back one hop", async () => {
    const { lsp, markJump } = mountViewer();
    lsp.jump({ path: "src/env.ts", absolutePath: "/r/src/env.ts", inRepo: true, line: 2, character: 13 });
    await screen.findByText(/PRODUCT/);
    api.lspDefinition.mockResolvedValue(answer([location("src/name.ts", 1, 13)]));
    // jsdom has no layout: point the caret at the NAME word on line 2 and give the word a box
    const row = section().querySelector<HTMLElement>('[data-line="2"] [data-lsp-line]')!;
    const caret = document.createRange();
    caret.setStart(row.firstChild!, row.textContent!.indexOf("NAME") + 1);
    Object.assign(document, { caretRangeFromPoint: () => caret });
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    const pointer = lspPointer(section(), lsp);

    await fireEvent.click(row, { ctrlKey: true, clientX: 1, clientY: 1 });
    await waitFor(() => expect(section().getAttribute("aria-label")).toBe("Read-only file src/name.ts"));
    expect(api.lspDefinition.mock.calls[0]![0]).toMatchObject({ path: "src/env.ts", side: "new", line: 2, character: row.textContent!.indexOf("NAME") });
    expect(markJump).toHaveBeenCalledTimes(1);

    expect(lsp.viewerBack()).toBe(true);
    await waitFor(() => expect(section().getAttribute("aria-label")).toBe("Read-only file src/env.ts"));
    expect(lsp.viewerBack()).toBe(false);
    expect(lsp.viewer).toBeNull();
    pointer.destroy();
  });

  it("a file outside the repository says it cannot be followed instead of doing nothing", async () => {
    const { lsp } = mountViewer();
    api.lspFile.mockResolvedValue({ content: "declare const x: number;\n" });
    lsp.jump({ path: null, absolutePath: "/ext/lib.d.ts", uri: "file:///ext/lib.d.ts", inRepo: false, line: 1, character: 14 });
    await screen.findByText(/declare/);

    await typeKeys("g", "d");

    expect(api.lspDefinition).not.toHaveBeenCalled();
    expect(lsp.notice?.text).toMatch(/outside the repository/);
  });

  it("gg still scrolls to the top and a lone g does nothing else", async () => {
    const { lsp } = mountViewer();
    lsp.jump({ path: "src/env.ts", absolutePath: "/r/src/env.ts", inRepo: true, line: 2, character: 13 });
    await screen.findByText(/PRODUCT/);

    await typeKeys("g");
    expect(scrollTo).not.toHaveBeenCalled();
    await typeKeys("g");
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(api.lspDefinition).not.toHaveBeenCalled();
  });

  it("a word the pointer rested on in the previous viewer is not reused after a hop", async () => {
    const { lsp } = mountViewer();
    lsp.jump({ path: "src/env.ts", absolutePath: "/r/src/env.ts", inRepo: true, line: 2, character: 13 });
    await screen.findByText(/PRODUCT/);
    const row = section().querySelector<HTMLElement>('[data-line="1"] [data-lsp-line]')!;
    lsp.point(hitInRow(row, { start: 9, end: 13, text: "NAME" }));
    lsp.jump({ path: "src/name.ts", absolutePath: "/r/src/name.ts", inRepo: true, line: 1, character: 13 });
    await waitFor(() => expect(section().getAttribute("aria-label")).toBe("Read-only file src/name.ts"));
    await screen.findByText(/nittle/);
    api.lspDefinition.mockResolvedValue(answer([]));

    await typeKeys("g", "d");

    await waitFor(() => expect(api.lspDefinition).toHaveBeenCalled());
    expect(api.lspDefinition.mock.calls[0]![0]).toEqual({ path: "src/name.ts", side: "new", line: 1, character: 13 });
  });
});
