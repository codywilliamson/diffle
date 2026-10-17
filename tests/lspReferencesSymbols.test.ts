// references, document/workspace symbols and the read-only file route, against the fake server.

import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { MAX_REFERENCES, REFERENCE_CONTEXT_LINES } from "../src/server/lspReferences";
import { MAX_WORKSPACE_SYMBOLS } from "../src/server/lspSymbols";
import { FAKE_LSP_PATH, fakeEntry, scriptFake, tempDir } from "./helpers/fakeLspPool";
import { diffFile, fileUri, startHarness, writeFiles, type Harness } from "./helpers/lspHttp";

const harnesses: Harness[] = [];
const pools: LspPool[] = [];
afterEach(() => {
  for (const h of harnesses.splice(0)) h.stop();
  for (const p of pools.splice(0)) p.killAll();
  delete process.env.FAKE_LSP;
});

const range = (line: number, from: number, to: number) => ({ start: { line, character: from }, end: { line, character: to } });
const at = (uri: string, line: number, from = 0, to = 1) => ({ uri, range: range(line, from, to) });
const numbered = (count: number) => Array.from({ length: count }, (_, i) => `line ${i + 1}`).join("\n") + "\n";

function setup(root: string, fake: Record<string, unknown>, files = [diffFile("a.ts")]) {
  scriptFake(fake);
  const pool = new LspPool({ root, registry: { typescript: fakeEntry(), csharp: fakeEntry() }, shutdownTimeoutMs: 500 });
  pools.push(pool);
  const harness = startHarness(root, pool, files);
  harnesses.push(harness);
  return { pool, harness };
}
const where = { path: "a.ts", side: "new", line: 1, character: 0 };

describe("references", () => {
  test("groups by file, diff files first with changed, sorted, with context lines", async () => {
    const root = tempDir("refs");
    writeFiles(root, { "a.ts": numbered(10), "b.ts": numbered(10), "z.ts": numbered(10) });
    const refs = [at(fileUri(root, "z.ts"), 4), at(fileUri(root, "b.ts"), 6), at(fileUri(root, "b.ts"), 1), at(fileUri(root, "z.ts"), 4), at(fileUri(root, "a.ts"), 0)];
    const { harness } = setup(root, { responses: { "textDocument/references": refs } }, [diffFile("a.ts"), diffFile("b.ts")]);
    const body = await (await harness.post("/api/lsp/references", where)).json() as any;
    expect(body.files.map((f: any) => [f.path, f.changed, f.references.length])).toEqual([["a.ts", true, 1], ["b.ts", true, 2], ["z.ts", false, 1]]);
    expect(body).toMatchObject({ total: 4, truncated: false }); // the duplicate collapses
    const b = body.files[1].references;
    expect(b.map((r: any) => r.range.start.line)).toEqual([2, 7]);
    expect(b[1].contextStartLine).toBe(7 - REFERENCE_CONTEXT_LINES);
    expect(b[1].contextLines).toEqual(["line 5", "line 6", "line 7", "line 8", "line 9"]);
    expect(b[0].contextLines[0]).toBe("line 1"); // clamped at the top of the file
  });

  test("caps at MAX_REFERENCES, keeping the diff's files, and reports the total", async () => {
    const root = tempDir("refs");
    const many = MAX_REFERENCES + 25;
    writeFiles(root, { "a.ts": numbered(many + 1), "b.ts": numbered(3) });
    const refs = [at(fileUri(root, "b.ts"), 1), ...Array.from({ length: many }, (_, i) => at(fileUri(root, "a.ts"), i))];
    const { harness } = setup(root, { responses: { "textDocument/references": refs } }, [diffFile("a.ts")]);
    const body = await (await harness.post("/api/lsp/references", where)).json() as any;
    expect(body).toMatchObject({ total: many + 1, truncated: true });
    expect(body.files.flatMap((f: any) => f.references)).toHaveLength(MAX_REFERENCES);
    expect(body.files.map((f: any) => f.path)).toEqual(["a.ts"]);
  });

  test("outside-repo references come last and carry no repo path", async () => {
    const root = tempDir("refs");
    const outside = tempDir("outside");
    writeFiles(root, { "a.ts": numbered(3) });
    writeFiles(outside, { "lib.ts": numbered(3) });
    const { harness } = setup(root, { responses: { "textDocument/references": [at(fileUri(outside, "lib.ts"), 0), at(fileUri(root, "a.ts"), 1)] } });
    const body = await (await harness.post("/api/lsp/references", where)).json() as any;
    expect(body.files.map((f: any) => [f.path, f.inRepo])).toEqual([["a.ts", true], [null, false]]);
    expect(body.files[1].references[0].contextLines).toEqual(["line 1", "line 2", "line 3"]);
  });
});

describe("document symbols", () => {
  const klass = () => [{
    name: "Box", kind: 5, range: { start: { line: 0, character: 0 }, end: { line: 8, character: 1 } }, selectionRange: range(0, 6, 9),
    children: [
      { name: "open", kind: 6, range: range(1, 2, 3), selectionRange: range(1, 2, 6) },
      { name: "close", kind: 6, range: range(5, 2, 6), selectionRange: range(5, 2, 7) },
    ],
  }, { name: "helper", kind: 12, range: range(9, 0, 9), selectionRange: range(9, 9, 15) }];

  test("nests class > method and marks symbols overlapping a changed line", async () => {
    const root = tempDir("sym");
    writeFiles(root, { "a.ts": numbered(12) });
    const { harness } = setup(root, { responses: { "textDocument/documentSymbol": klass() } }, [diffFile("a.ts", [2])]);
    const body = await (await harness.get("/api/lsp/symbols?path=a.ts")).json() as any;
    const [box, helper] = body.symbols;
    expect([box.name, box.kind, box.changed, helper.changed]).toEqual(["Box", "class", true, false]);
    expect(box.children.map((c: any) => [c.name, c.kind, c.changed])).toEqual([["open", "method", true], ["close", "method", false]]);
    expect(box.children[0].selectionRange.start).toEqual({ line: 2, character: 2 });
  });

  test("SymbolInformation arrives flat", async () => {
    const root = tempDir("sym");
    writeFiles(root, { "a.ts": numbered(4) });
    const info = [{ name: "open", kind: 6, containerName: "Box", location: at(fileUri(root, "a.ts"), 1) }];
    const { harness } = setup(root, { responses: { "textDocument/documentSymbol": info } });
    const body = await (await harness.get("/api/lsp/symbols?path=a.ts")).json() as any;
    expect(body.symbols).toHaveLength(1);
    expect(body.symbols[0]).toMatchObject({ name: "open", detail: "Box", children: [], changed: false });
  });

  test("needs ?path= or ?query=", async () => {
    const root = tempDir("sym");
    const { harness } = setup(root, {});
    expect((await harness.get("/api/lsp/symbols")).status).toBe(400);
  });
});

describe("workspace symbols", () => {
  test("fans out to every running server, merges, de-duplicates and ranks the diff first", async () => {
    const root = tempDir("ws");
    writeFiles(root, { "a.ts": numbered(3), "b.cs": numbered(3), "other.ts": numbered(3) });
    const sym = (name: string, uri: string) => ({ name, kind: 5, location: at(uri, 1) });
    const ts = { responses: { "workspace/symbol": [sym("Far", fileUri(root, "other.ts")), sym("Both", fileUri(root, "a.ts"))] } };
    const cs = { responses: { "workspace/symbol": [sym("Both", fileUri(root, "a.ts")), sym("Near", fileUri(root, "b.cs"))] } };
    const entry = (cfg: object) => ({ ...fakeEntry(), candidates: [{ command: process.execPath, args: () => [FAKE_LSP_PATH, JSON.stringify(cfg)] }] });
    const pool = new LspPool({ root, registry: { typescript: entry(ts), csharp: entry(cs) }, shutdownTimeoutMs: 500 });
    pools.push(pool);
    const harness = startHarness(root, pool, [diffFile("a.ts"), diffFile("b.cs")]);
    harnesses.push(harness);
    const body = await (await harness.get("/api/lsp/symbols?query=o")).json() as any;
    expect(body.symbols.map((s: any) => [s.name, s.path, s.inDiff])).toEqual([["Both", "a.ts", true], ["Near", "b.cs", true], ["Far", "other.ts", false]]);
    expect(body).toMatchObject({ total: 3, truncated: false });
  });

  test("is capped", async () => {
    const root = tempDir("ws");
    writeFiles(root, { "a.ts": numbered(2) });
    const many = Array.from({ length: MAX_WORKSPACE_SYMBOLS + 7 }, (_, i) => ({ name: `S${i}`, kind: 12, location: at(fileUri(root, "a.ts"), 0, i, i + 1) }));
    const { harness } = setup(root, { responses: { "workspace/symbol": many } });
    const body = await (await harness.get("/api/lsp/symbols?query=S")).json() as any;
    expect(body).toMatchObject({ total: MAX_WORKSPACE_SYMBOLS + 7, truncated: true });
    expect(body.symbols).toHaveLength(MAX_WORKSPACE_SYMBOLS);
  });
});

describe("GET /api/lsp/file allowlist", () => {
  test("serves only paths the server returned as targets", async () => {
    const root = tempDir("file");
    const outside = tempDir("outside");
    writeFiles(root, { "a.ts": "x\n", "util.ts": "export {}\n", "secret.env": "TOKEN=1\n" });
    writeFiles(outside, { "lib.d.ts": "declare const lib: 1;\n", "private.txt": "nope\n" });
    const returned = [at(fileUri(root, "util.ts"), 0), at(fileUri(outside, "lib.d.ts"), 0)];
    const { harness } = setup(root, { responses: { "textDocument/definition": returned } });
    const get = (uri: string) => harness.get(`/api/lsp/file?uri=${encodeURIComponent(uri)}`);

    expect((await get(fileUri(root, "util.ts"))).status).toBe(403); // not handed out yet
    await harness.post("/api/lsp/definition", where);

    const util = await (await get(fileUri(root, "util.ts"))).json() as any;
    expect(util).toMatchObject({ path: "util.ts", inRepo: true, inDiff: false, content: "export {}\n" });
    const lib = await (await get(fileUri(outside, "lib.d.ts"))).json() as any;
    expect(lib).toMatchObject({ path: null, inRepo: false, absolutePath: join(outside, "lib.d.ts"), content: "declare const lib: 1;\n" });

    for (const uri of [fileUri(root, "secret.env"), fileUri(outside, "private.txt"), fileUri(root, "../etc/passwd")]) expect((await get(uri)).status).toBe(403);
    expect((await get("https://example.com/x")).status).toBe(400);
    expect((await harness.get("/api/lsp/file")).status).toBe(400);
  });

  test("a returned target that vanished is a 404", async () => {
    const root = tempDir("file");
    writeFiles(root, { "a.ts": "x\n" });
    const { harness } = setup(root, { responses: { "textDocument/definition": at(fileUri(root, "gone.ts"), 0) } });
    await harness.post("/api/lsp/definition", where);
    expect((await harness.get(`/api/lsp/file?uri=${encodeURIComponent(fileUri(root, "gone.ts"))}`)).status).toBe(404);
  });
});
