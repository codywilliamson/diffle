// definition, hover, document sync, error mapping and position conversion over the http routes,
// against the scriptable fake language server.

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { fakePool, scriptFake, tempDir } from "./helpers/fakeLspPool";
import { diffFile, fileUri, gitRepo, stage, startHarness, writeFiles, type Harness } from "./helpers/lspHttp";

const harnesses: Harness[] = [];
const pools: LspPool[] = [];
afterEach(() => {
  for (const h of harnesses.splice(0)) h.stop();
  for (const p of pools.splice(0)) p.killAll();
  delete process.env.FAKE_LSP;
});

function setup(root: string, fake: Record<string, unknown>, files = [diffFile("a.ts")], newRef: string | null = null) {
  scriptFake(fake);
  const pool = fakePool(root);
  pools.push(pool);
  const harness = startHarness(root, pool, files, newRef);
  harnesses.push(harness);
  const state = async () => (await (await pool.ensure("typescript"))!.request("fake/state")) as any;
  return { pool, harness, state };
}

const range = (line: number, from: number, to: number) => ({ start: { line, character: from }, end: { line, character: to } });
const LINE = 'const 日本 = "😀"; use(日本);';
const USE = LINE.indexOf("use(");
const bytes = (text: string) => Buffer.byteLength(text);

describe("definition", () => {
  test.each([
    ["Location", (uri: string) => ({ uri, range: range(0, 13, 16) })],
    ["Location[]", (uri: string) => [{ uri, range: range(0, 13, 16) }]],
    ["LocationLink[]", (uri: string) => [{ targetUri: uri, targetRange: range(0, 0, 24), targetSelectionRange: range(0, 13, 16) }]],
  ])("normalizes %s", async (_name, shape) => {
    const root = tempDir("def");
    writeFiles(root, { "a.ts": LINE + "\n", "b.ts": "export const 日本語 = 1;\n" });
    const { harness } = setup(root, { responses: { "textDocument/definition": shape(fileUri(root, "b.ts")) } }, [diffFile("a.ts"), diffFile("b.ts")]);
    const res = await harness.post("/api/lsp/definition", { path: "a.ts", side: "new", line: 1, character: USE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      targets: [{ uri: fileUri(root, "b.ts"), path: "b.ts", absolutePath: join(root, "b.ts"), inRepo: true, inDiff: true, range: { start: { line: 1, character: 13 }, end: { line: 1, character: 16 } } }],
      onDefinition: false,
    });
  });

  test("a repo file outside the diff, a dependency and a stdlib file", async () => {
    const root = tempDir("def");
    const outside = tempDir("outside");
    writeFiles(root, { "a.ts": LINE + "\n", "util.ts": "x\n", "node_modules/dep/index.d.ts": "d\n" });
    writeFiles(outside, { "lib.d.ts": "l\n" });
    const at = (uri: string) => ({ uri, range: range(0, 0, 1) });
    const { harness } = setup(root, { responses: { "textDocument/definition": [at(fileUri(root, "util.ts")), at(fileUri(root, "node_modules/dep/index.d.ts")), at(fileUri(outside, "lib.d.ts")), at("jar:file:///x.jar!/A.class")] } });
    const body = await (await harness.post("/api/lsp/definition", { path: "a.ts", side: "new", line: 1, character: USE })).json() as any;
    expect(body.targets.map((t: any) => [t.path, t.inRepo, t.inDiff])).toEqual([["util.ts", true, false], [null, false, false], [null, false, false]]);
    expect(body.targets[2].absolutePath).toBe(join(outside, "lib.d.ts"));
  });

  test("onDefinition is set when the request sits on the declaration, never for typeDefinition", async () => {
    const root = tempDir("def");
    writeFiles(root, { "a.ts": LINE + "\n" });
    const self = { uri: fileUri(root, "a.ts"), range: range(0, USE, USE + 3) };
    const { harness, state } = setup(root, { responses: { "textDocument/definition": self, "textDocument/typeDefinition": self } });
    const ask = (kind?: string) => harness.post("/api/lsp/definition", { path: "a.ts", side: "new", line: 1, character: USE + 1, ...(kind ? { kind } : {}) }).then((r) => r.json()) as Promise<any>;
    expect((await ask()).onDefinition).toBe(true);
    expect((await ask("typeDefinition")).onDefinition).toBe(false);
    expect((await state()).requests.map((r: any) => r.method)).toEqual(["textDocument/definition", "textDocument/typeDefinition"]);
    expect((await harness.post("/api/lsp/definition", { path: "a.ts", side: "new", line: 1, character: 0, kind: "nope" })).status).toBe(400);
  });

  test("a definition elsewhere in the same file is not onDefinition", async () => {
    const root = tempDir("def");
    writeFiles(root, { "a.ts": LINE + "\nlet y;\n" });
    const { harness } = setup(root, { responses: { "textDocument/definition": { uri: fileUri(root, "a.ts"), range: range(1, 4, 5) } } });
    const body = await (await harness.post("/api/lsp/definition", { path: "a.ts", side: "new", line: 1, character: USE })).json() as any;
    expect(body.onDefinition).toBe(false);
  });
});

describe("position conversion", () => {
  test.each([
    ["utf-16", USE],
    ["utf-8", bytes(LINE.slice(0, USE))],
    ["utf-32", [...LINE.slice(0, USE)].length],
  ])("%s with emoji and CJK on the line", async (encoding, sentCharacter) => {
    const root = tempDir("pos");
    writeFiles(root, { "a.ts": LINE + "\n", "b.ts": "export const 日本語 = 1;\n" });
    // the fake answers in the negotiated unit: 日本語 is 9 bytes, 3 code points, 3 units
    const reply = { uri: fileUri(root, "b.ts"), range: range(0, 13, encoding === "utf-8" ? 22 : 16) };
    const { harness, state } = setup(root, { encoding, responses: { "textDocument/definition": reply } });
    const body = await (await harness.post("/api/lsp/definition", { path: "a.ts", side: "new", line: 1, character: USE })).json() as any;
    const sent = (await state()).requests[0].params.position;
    expect(sent).toEqual({ line: 0, character: sentCharacter });
    expect(body.targets[0].range).toEqual({ start: { line: 1, character: 13 }, end: { line: 1, character: 16 } });
  });
});

describe("hover", () => {
  const hover = async (contents: unknown, extra: Record<string, unknown> = {}) => {
    const root = tempDir("hover");
    writeFiles(root, { "a.ts": LINE + "\n" });
    const { harness } = setup(root, { responses: { "textDocument/hover": { contents, ...extra } } });
    return (await (await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: USE })).json()) as any;
  };

  test("normalizes the content shapes and converts the range", async () => {
    expect(await hover({ kind: "markdown", value: "**f**" }, { range: range(0, USE, USE + 3) })).toEqual({
      contents: "**f**", range: { start: { line: 1, character: USE }, end: { line: 1, character: USE + 3 } },
    });
    expect((await hover([{ language: "typescript", value: "function use(): void" }, "docs"])).contents).toBe("```typescript\nfunction use(): void\n```\n\ndocs");
    expect((await hover({ kind: "plaintext", value: "use(): void" })).contents).toBe("```typescript\nuse(): void\n```");
  });

  test("nothing under the cursor is an empty answer, not an error", async () => {
    const root = tempDir("hover");
    writeFiles(root, { "a.ts": LINE + "\n" });
    const { harness } = setup(root, { responses: { "textDocument/hover": null } });
    const res = await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 });
    expect(await res.json()).toEqual({ contents: "" });
  });

  test("a newer hover from the same client cancels the one in flight", async () => {
    const root = tempDir("hover");
    writeFiles(root, { "a.ts": LINE + "\n" });
    const { harness, state } = setup(root, { hang: ["textDocument/hover"] });
    const headers = { "x-client-id": "tab-1" };
    const body = { path: "a.ts", side: "new", line: 1, character: 2 };
    const first = harness.post("/api/lsp/hover", body, { headers });
    await (async () => { while ((await state()).requests.length < 1) await Bun.sleep(10); })();
    const second = harness.post("/api/lsp/hover", body, { headers });
    const firstRes = await first;
    expect(firstRes.status).toBe(499);
    expect((await firstRes.json() as any).code).toBe("cancelled");
    await (async () => { while ((await state()).cancelled.length < 1) await Bun.sleep(10); })();
    expect((await state()).cancelled).toHaveLength(1);
    second.catch(() => {});
  });

  test("a client that hangs up cancels the request on the server", async () => {
    const root = tempDir("hover");
    writeFiles(root, { "a.ts": LINE + "\n" });
    const { harness, state } = setup(root, { hang: ["textDocument/hover"] });
    const abort = new AbortController();
    const pending = harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 2 }, { signal: abort.signal });
    await (async () => { while ((await state()).requests.length < 1) await Bun.sleep(10); })();
    abort.abort();
    await expect(pending).rejects.toThrow();
    await (async () => { while ((await state()).cancelled.length < 1) await Bun.sleep(10); })();
    expect((await state()).cancelled).toHaveLength(1);
  });
});

describe("document sync: the server sees what the reviewer sees", () => {
  test("opens once, then sends didChange with a version bump only when the text moved", async () => {
    const root = tempDir("sync");
    writeFiles(root, { "a.ts": "one\n" });
    const { harness, state } = setup(root, { responses: { "textDocument/hover": null } });
    const ask = () => harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 });
    await ask(); await ask();
    let s = await state();
    expect(s.docs[fileUri(root, "a.ts")]).toEqual({ version: 1, text: "one\n" });
    expect(s.changes).toHaveLength(0);
    writeFileSync(join(root, "a.ts"), "two\n");
    await ask();
    s = await state();
    expect(s.docs[fileUri(root, "a.ts")]).toEqual({ version: 2, text: "two\n" });
    expect(s.changes).toHaveLength(1);
  });

  test("a branch review on a dirty checkout is served from a worktree, not the files on disk", async () => {
    const root = gitRepo({ "a.ts": "committed\n" });
    writeFileSync(join(root, "a.ts"), "dirty on disk\n");
    const { harness, pool } = setup(root, { responses: { "textDocument/hover": null } }, [diffFile("a.ts")], "HEAD");
    await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 });
    const docs = ((await pool.running()[0]!.request("fake/state")) as any).docs as Record<string, { text: string }>;
    expect(Object.values(docs).map((doc) => doc.text.replace(/\r\n/g, "\n"))).toEqual(["committed\n"]);
    expect(docs[fileUri(root, "a.ts")]).toBeUndefined();
  });

  test("a branch review on a clean checkout uses the checkout itself", async () => {
    const root = gitRepo({ "a.ts": "committed\n" });
    const { harness, state } = setup(root, { responses: { "textDocument/hover": null } }, [diffFile("a.ts")], "HEAD");
    await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 });
    expect((await state()).docs[fileUri(root, "a.ts")].text).toBe("committed\n");
  });

  test("a staged review sends the index", async () => {
    const root = gitRepo({ "a.ts": "committed\n" });
    writeFileSync(join(root, "a.ts"), "staged\n");
    stage(root);
    writeFileSync(join(root, "a.ts"), "unstaged\n");
    const { harness, state } = setup(root, { responses: { "textDocument/hover": null } }, [diffFile("a.ts")], "");
    await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 });
    expect((await state()).docs[fileUri(root, "a.ts")].text).toBe("staged\n");
  });

  test("every request re-syncs the other open documents, and closes one that vanished", async () => {
    const root = tempDir("sync");
    writeFiles(root, { "a.ts": "a1\n", "b.ts": "b1\n" });
    const { harness, state } = setup(root, { responses: { "textDocument/hover": null } }, [diffFile("a.ts"), diffFile("b.ts")]);
    const ask = (path: string) => harness.post("/api/lsp/hover", { path, side: "new", line: 1, character: 0 });
    await ask("a.ts"); await ask("b.ts");
    writeFileSync(join(root, "a.ts"), "a2\n");
    await ask("b.ts"); // a.ts is not the one asked about, but the server must still hear about it
    expect((await state()).docs[fileUri(root, "a.ts")]).toEqual({ version: 2, text: "a2\n" });
    rmSync(join(root, "a.ts"));
    await ask("b.ts");
    expect((await state()).closed).toEqual([fileUri(root, "a.ts")]);
  });

  test("the first request waits for the server's project load to finish; later ones do not", async () => {
    const root = tempDir("sync");
    writeFiles(root, { "a.ts": "x\n" });
    // a request that waited on a fresh load would take the whole window again, so the bounds sit
    // either side of it with room for a loaded machine to slow the quick call down
    const loadMs = 3_000;
    const { harness } = setup(root, { progress: { delayMs: 0, durationMs: loadMs }, responses: { "textDocument/hover": null } });
    const timed = async () => { const t = performance.now(); await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 }); return performance.now() - t; };
    expect(await timed()).toBeGreaterThan(loadMs * 0.66);
    expect(await timed()).toBeLessThan(loadMs);
  });

  test("nothing is written into the checkout", async () => {
    const root = gitRepo({ "a.ts": "x\n" });
    const { harness } = setup(root, { responses: { "textDocument/hover": null } }, [diffFile("a.ts")], "HEAD");
    await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 });
    expect(Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root }).stdout.toString()).toBe("");
  });
});

describe("errors", () => {
  const routes = [
    ["POST", "/api/lsp/definition"], ["POST", "/api/lsp/hover"], ["POST", "/api/lsp/references"],
    ["GET", "/api/lsp/symbols?path=a.ts"], ["GET", "/api/lsp/symbols?query=foo"],
  ] as const;
  const call = (h: Harness, method: string, route: string) =>
    method === "POST" ? h.post(route, { path: "a.ts", side: "new", line: 1, character: 0 }) : h.get(route);

  test.each(routes)("no language server installed: %s %s answers 409 with a hint and logs nothing", async (method, route) => {
    const root = tempDir("none");
    writeFiles(root, { "a.ts": "x\n" });
    const pool = new LspPool({ root, searchPath: "" });
    pools.push(pool);
    const harness = startHarness(root, pool, [diffFile("a.ts")]);
    harnesses.push(harness);
    const errors = spyOn(console, "error");
    const res = await call(harness, method, route);
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body).toMatchObject({ code: "server-unavailable", state: "missing" });
    expect(body.hint).toContain("npm install");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  test("--no-lsp and a missing pool also answer 409", async () => {
    const root = tempDir("none");
    writeFiles(root, { "a.ts": "x\n" });
    for (const pool of [new LspPool({ root, enabled: false }), undefined]) {
      const harness = startHarness(root, pool, [diffFile("a.ts")]);
      harnesses.push(harness);
      const res = await harness.post("/api/lsp/hover", { path: "a.ts", side: "new", line: 1, character: 0 });
      expect([res.status, (await res.json() as any).code]).toEqual([409, "server-unavailable"]);
    }
  });

  test("a file type with no language server is a 409 too", async () => {
    const root = tempDir("none");
    writeFiles(root, { "README.md": "x\n" });
    const { harness } = setup(root, {});
    const res = await harness.post("/api/lsp/hover", { path: "README.md", side: "new", line: 1, character: 0 });
    expect(res.status).toBe(409);
  });

  test("the old side of a review with no base commit is refused, and starts nothing", async () => {
    const root = tempDir("old");
    writeFiles(root, { "a.ts": "x\n" });
    const { harness, pool } = setup(root, {});
    const res = await harness.post("/api/lsp/definition", { path: "a.ts", side: "old", line: 1, character: 0 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "old-side-unsupported", hint: expect.stringContaining("no base commit") });
    expect(pool.status(["typescript"])[0]?.state).toBe("idle");
  });

  test("bad input is a 400 and a missing file a 404", async () => {
    const root = tempDir("bad");
    writeFiles(root, { "a.ts": "x\n" });
    const { harness } = setup(root, {});
    const post = (body: unknown) => harness.post("/api/lsp/definition", body);
    expect((await harness.post("/api/lsp/definition", "{nope")).status).toBe(400);
    for (const bad of [
      { path: "../etc/passwd", side: "new", line: 1, character: 0 }, { path: "/etc/passwd", side: "new", line: 1, character: 0 },
      { path: "a.ts", side: "sideways", line: 1, character: 0 }, { path: "a.ts", side: "new", line: 0, character: 0 },
      { path: "a.ts", side: "new", line: 9, character: 0 }, { path: "a.ts", side: "new", line: 1, character: -1 },
      { path: "a.ts", side: "new", line: "1", character: 0 },
    ]) expect([bad, (await post(bad)).status]).toEqual([bad, 400]);
    expect((await post({ path: "gone.ts", side: "new", line: 1, character: 0 })).status).toBe(404);
  });

  test("a server error is a 502, not a 500", async () => {
    const root = tempDir("bad");
    writeFiles(root, { "a.ts": "x\n" });
    const { harness } = setup(root, {}); // the fake has no such method and answers -32601
    const res = await harness.post("/api/lsp/definition", { path: "a.ts", side: "new", line: 1, character: 0 });
    expect([res.status, (await res.json() as any).code]).toEqual([502, "request-failed"]);
  });

  test("lsp routes refuse a foreign origin", async () => {
    const root = tempDir("guard");
    writeFiles(root, { "a.ts": "x\n" });
    const { harness } = setup(root, {});
    const evil = { headers: { Origin: "http://evil.example" } };
    expect((await harness.post("/api/lsp/definition", {}, evil)).status).toBe(403);
    expect((await harness.get("/api/lsp/symbols?query=x", evil)).status).toBe(403);
    expect((await harness.get("/api/lsp/file?uri=file:///x", evil)).status).toBe(403);
  });
});
