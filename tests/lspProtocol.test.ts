import { describe, expect, test } from "bun:test";
import { hoverToMarkdown, isOnDefinition, normalizeTargets, rangeContains } from "../src/core/lsp/protocol";
import { normalizeDocumentSymbols, normalizeWorkspaceSymbols, symbolKindName } from "../src/core/lsp/symbols";
import { changedNewLines } from "../src/server/lspSymbols";
import { diffFile } from "./helpers/lspHttp";

const range = (line: number, from: number, to: number) => ({ start: { line, character: from }, end: { line, character: to } });

describe("normalizeTargets", () => {
  test("Location, Location[], LocationLink[] and null", () => {
    const location = { uri: "file:///a.ts", range: range(1, 2, 5) };
    const link = { targetUri: "file:///b.ts", targetRange: range(0, 0, 9), targetSelectionRange: range(0, 4, 6), originSelectionRange: range(3, 0, 1) };
    expect(normalizeTargets(location)).toEqual([{ uri: "file:///a.ts", range: location.range, selection: location.range }]);
    expect(normalizeTargets([location, location])).toHaveLength(2);
    expect(normalizeTargets([link])).toEqual([{ uri: "file:///b.ts", range: link.targetRange, selection: link.targetSelectionRange }]);
    expect(normalizeTargets(null)).toEqual([]);
    expect(normalizeTargets([{ nonsense: true }, 4, null])).toEqual([]);
  });

  test("a link without a selection range falls back to the whole target range", () => {
    const [target] = normalizeTargets([{ targetUri: "file:///b.ts", targetRange: range(2, 0, 4) }]);
    expect(target?.selection).toEqual(range(2, 0, 4));
  });
});

describe("rangeContains / isOnDefinition", () => {
  test("inclusive on both ends, line-aware", () => {
    const r = range(3, 4, 8);
    expect(rangeContains(r, { line: 3, character: 4 })).toBe(true);
    expect(rangeContains(r, { line: 3, character: 8 })).toBe(true);
    expect(rangeContains(r, { line: 3, character: 9 })).toBe(false);
    expect(rangeContains(r, { line: 2, character: 99 })).toBe(false);
    expect(rangeContains(range(1, 0, 0), { line: 1, character: 0 })).toBe(true);
  });

  test("uses the selection (name), not the whole declaration, and only in the same file", () => {
    const targets = normalizeTargets([{ targetUri: "file:///a.ts", targetRange: range(0, 0, 20), targetSelectionRange: range(0, 9, 12) }]);
    const same = (a: string, b: string) => a === b;
    expect(isOnDefinition(targets, "file:///a.ts", { line: 5, character: 2 }, same)).toBe(false);
    expect(isOnDefinition(targets, "file:///a.ts", { line: 0, character: 10 }, same)).toBe(true);
    expect(isOnDefinition(targets, "file:///other.ts", { line: 0, character: 10 }, same)).toBe(false);
  });
});

describe("hoverToMarkdown", () => {
  test("MarkedString, MarkedString[] and MarkupContent", () => {
    expect(hoverToMarkdown("**bold**", "typescript")).toBe("**bold**");
    expect(hoverToMarkdown({ language: "ts", value: "let x: number" }, "typescript")).toBe("```ts\nlet x: number\n```");
    expect(hoverToMarkdown([{ language: "ts", value: "let x" }, "docs here"], "typescript")).toBe("```ts\nlet x\n```\n\ndocs here");
    expect(hoverToMarkdown({ kind: "markdown", value: "# hi" }, "typescript")).toBe("# hi");
  });

  test("plaintext content is fenced with the document language id", () => {
    expect(hoverToMarkdown({ kind: "plaintext", value: "x: int" }, "csharp")).toBe("```csharp\nx: int\n```");
  });

  test("the fence outgrows backticks inside the text; empty parts vanish", () => {
    expect(hoverToMarkdown({ kind: "plaintext", value: "a ``` b" }, "ts")).toBe("````ts\na ``` b\n````");
    expect(hoverToMarkdown(["", "  ", null, { kind: "markdown", value: "ok" }], "ts")).toBe("ok");
    expect(hoverToMarkdown(undefined, "ts")).toBe("");
  });
});

describe("symbol normalizers", () => {
  test("DocumentSymbol nests and keeps the selection range", () => {
    const [klass] = normalizeDocumentSymbols([{
      name: "Box", kind: 5, range: range(0, 0, 9), selectionRange: range(0, 6, 9),
      children: [{ name: "open", kind: 6, detail: "(): void", range: range(1, 2, 4), selectionRange: range(1, 2, 6) }],
    }]);
    expect(klass).toMatchObject({ name: "Box", kind: "class", selection: range(0, 6, 9) });
    expect(klass?.children[0]).toMatchObject({ name: "open", kind: "method", detail: "(): void" });
  });

  test("SymbolInformation stays one flat level, container name as detail", () => {
    const symbols = normalizeDocumentSymbols([{ name: "open", kind: 6, containerName: "Box", location: { uri: "file:///a.ts", range: range(1, 0, 3) } }]);
    expect(symbols).toEqual([{ name: "open", kind: "method", detail: "Box", range: range(1, 0, 3), selection: range(1, 0, 3), children: [] }]);
  });

  test("workspace symbols tolerate a location without a range", () => {
    const [symbol] = normalizeWorkspaceSymbols([{ name: "Foo", kind: 12, containerName: "ns", location: { uri: "file:///a.ts" } }, { junk: 1 }]);
    expect(symbol).toMatchObject({ name: "Foo", kind: "function", containerName: "ns", uri: "file:///a.ts", range: range(0, 0, 0) });
    expect(symbolKindName(999)).toBe("unknown");
  });
});

describe("changedNewLines", () => {
  test("additions mark their lines; a removal marks the line now in its place", () => {
    const file = diffFile("a.ts");
    file.hunks = [{
      header: "@@", lines: [
        { type: "context", oldLine: 1, newLine: 1, content: "" },
        { type: "deletion", oldLine: 2, newLine: null, content: "" },
        { type: "context", oldLine: 3, newLine: 2, content: "" },
        { type: "addition", oldLine: null, newLine: 3, content: "" },
        { type: "deletion", oldLine: 4, newLine: null, content: "" },
      ],
    }];
    expect([...changedNewLines(file)].sort()).toEqual([2, 3, 4]);
    expect(changedNewLines(undefined).size).toBe(0);
  });
});
