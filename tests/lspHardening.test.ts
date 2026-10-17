// races, sync cost, file reads and authorization: the review-round fixes for the lsp routes.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { MAX_RETAINED_TEXT_BYTES, MAX_TARGET_FILE_BYTES, readRegularFile, readRepoText, retainedTextBytes } from "../src/server/lspText";
import { MAX_OPEN_DOCUMENTS } from "../src/server/lspSync";
import { fakePool, scriptFake, tempDir } from "./helpers/fakeLspPool";
import { diffFile, fileUri, gitRepo, startHarness, writeFiles, type Harness } from "./helpers/lspHttp";

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
const at = (uri: string, line = 0) => ({ uri, range: { start: { line, character: 0 }, end: { line, character: 1 } } });
const where = (path = "a.ts") => ({ path, side: "new", line: 1, character: 0 });
const until = async (check: () => Promise<boolean>) => { for (let i = 0; i < 300 && !(await check()); i++) await Bun.sleep(10); };

describe("version races", () => {
  test("an edit between sync and answer discards the answer and retries once", async () => {
    const root = tempDir("race");
    writeFiles(root, { "a.ts": "one\n" });
    const { harness, state } = setup(root, { delay: { "textDocument/definition": 400 }, responses: { "textDocument/definition": at(fileUri(root, "a.ts")), "textDocument/hover": null } });
    const slow = harness.post("/api/lsp/definition", where());
    await until(async () => (await state()).requests.length >= 1);
    writeFileSync(join(root, "a.ts"), "two!\n");
    await harness.post("/api/lsp/hover", where()); // a concurrent request carries the edit to the server
    const res = await slow;
    expect(res.status).toBe(200);
    const s = await state();
    expect(s.requests.filter((r: any) => r.method === "textDocument/definition")).toHaveLength(2); // original + retry
    expect(s.docs[fileUri(root, "a.ts")]).toEqual({ version: 2, text: "two!\n" });
  });

  test("a file that keeps changing under the request is a 409 stale", async () => {
    const root = tempDir("race");
    writeFiles(root, { "a.ts": "0\n" });
    const { harness, state } = setup(root, { delay: { "textDocument/definition": 500 }, responses: { "textDocument/definition": at(fileUri(root, "a.ts")), "textDocument/hover": null } });
    const slow = harness.post("/api/lsp/definition", where());
    let edits = 0;
    const hovers: Promise<unknown>[] = [];
    const timer = setInterval(() => { writeFileSync(join(root, "a.ts"), `${++edits}${"x".repeat(edits)}\n`); hovers.push(harness.post("/api/lsp/hover", where()).catch(() => undefined)); }, 120);
    const res = await slow;
    clearInterval(timer);
    await Promise.all(hovers); // none may outlive the test and fail a later one
    expect([res.status, (await res.json() as any).code]).toEqual([409, "stale"]);
    expect((await state()).requests.length).toBeGreaterThan(1);
  });
});

describe("a diff refresh makes an in-flight answer stale", () => {
  test("a delayed definition, then a commit + GET /api/diff: the old answer is not returned", async () => {
    const root = gitRepo({ "a.ts": "v1\n" });
    const { harness, state } = setup(root, { delay: { "textDocument/definition": 2000 }, responses: { "textDocument/definition": at(fileUri(root, "a.ts")) } }, [diffFile("a.ts")], "HEAD");
    harness.ctx.diffArgs = ["diff", "HEAD"];
    const slow = harness.post("/api/lsp/definition", where());
    await until(async () => (await state()).requests.length >= 1);
    writeFileSync(join(root, "a.ts"), "v2\n");
    Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "two"], { cwd: root });
    await harness.get("/api/diff"); await harness.get("/api/diff"); // the first call hands out the launch diff; the second refreshes
    expect(harness.ctx.diffGeneration).toBe(1);
    expect((await slow).status).toBe(200);
    const s = await state();
    expect(s.requests.filter((r: any) => r.method === "textDocument/definition")).toHaveLength(2);
    expect(s.docs[fileUri(root, "a.ts")]).toEqual({ version: 2, text: "v2\n" });
  });
});

describe("retained text is bounded", () => {
  test("reading many large distinct files keeps retained bytes under the cap", () => {
    const root = tempDir("bounded");
    const big = "x".repeat(MAX_TARGET_FILE_BYTES - 10);
    const count = Math.ceil(MAX_RETAINED_TEXT_BYTES / (big.length * 2)) + 8;
    const { harness } = setup(root, {}, []);
    for (let i = 0; i < count; i++) {
      writeFileSync(join(root, `big${i}.txt`), big);
      expect(readRepoText(harness.ctx, `big${i}.txt`)).toHaveLength(big.length);
      expect(retainedTextBytes()).toBeLessThanOrEqual(MAX_RETAINED_TEXT_BYTES);
    }
    expect(retainedTextBytes()).toBeGreaterThan(MAX_RETAINED_TEXT_BYTES / 2);
  });
});

describe("workspace symbols sync first", () => {
  test("a file renamed on disk after it was opened reaches the server before the search", async () => {
    const root = tempDir("ws");
    writeFiles(root, { "a.ts": "export const oldName = 1;\n" });
    const { harness, state } = setup(root, { responses: { "textDocument/hover": null, "workspace/symbol": [] } });
    await harness.post("/api/lsp/hover", where());
    writeFileSync(join(root, "a.ts"), "export const newName = 1;\n");
    await harness.get("/api/lsp/symbols?query=newName");
    const s = await state();
    expect(s.docs[fileUri(root, "a.ts")]).toEqual({ version: 2, text: "export const newName = 1;\n" });
    expect(s.requests.at(-1).method).toBe("workspace/symbol");
  });

  test("a server with nothing open yet gets the diff's file opened so there is a project to search", async () => {
    const root = tempDir("ws");
    writeFiles(root, { "a.ts": "x\n" });
    const { harness, state } = setup(root, { responses: { "workspace/symbol": [] } });
    await harness.get("/api/lsp/symbols?query=x");
    expect(Object.keys((await state()).docs)).toEqual([fileUri(root, "a.ts")]);
  });
});

describe("document symbols forward the abort", () => {
  test("hanging up cancels the documentSymbol request on the server", async () => {
    const root = tempDir("sym");
    writeFiles(root, { "a.ts": "x\n" });
    const { harness, state } = setup(root, { hang: ["textDocument/documentSymbol"] });
    const abort = new AbortController();
    const pending = harness.get("/api/lsp/symbols?path=a.ts", { signal: abort.signal });
    await until(async () => (await state()).requests.length >= 1);
    abort.abort();
    await expect(pending).rejects.toThrow();
    await until(async () => (await state()).cancelled.length >= 1);
    expect((await state()).cancelled).toHaveLength(1);
  });
});

describe("sync cost", () => {
  test("open documents are bounded; the least recently used are closed", async () => {
    const root = tempDir("lru");
    const total = MAX_OPEN_DOCUMENTS + 3;
    const names = Array.from({ length: total }, (_, i) => `f${i}.ts`);
    writeFiles(root, Object.fromEntries(names.map((name) => [name, "x\n"])));
    const { harness, state } = setup(root, { responses: { "textDocument/hover": null } }, names.map((n) => diffFile(n)));
    for (const name of names) await harness.post("/api/lsp/hover", where(name));
    const s = await state();
    expect(Object.keys(s.docs).length - s.closed.length).toBe(MAX_OPEN_DOCUMENTS);
    expect(s.closed.slice(0, 3)).toEqual(names.slice(0, 3).map((n) => fileUri(root, n)));
  }, 60_000);

  test("a branch review reads each blob once per diff generation", async () => {
    const root = gitRepo({ "a.ts": "v1\n" });
    const { harness, state } = setup(root, { responses: { "textDocument/hover": null } }, [diffFile("a.ts")], "HEAD");
    await harness.post("/api/lsp/hover", where());
    writeFileSync(join(root, "a.ts"), "v2\n");
    Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "two"], { cwd: root });
    await harness.post("/api/lsp/hover", where());
    expect((await state()).docs[fileUri(root, "a.ts")].text).toBe("v1\n"); // same generation, same blob
    harness.ctx.diff = { ...harness.ctx.diff }; harness.ctx.diffGeneration = 1; // what GET /api/diff does on refresh
    await harness.post("/api/lsp/hover", where());
    expect((await state()).docs[fileUri(root, "a.ts")].text).toBe("v2\n");
  });
});

describe("file reads", () => {
  test("only regular files under the size cap are read", () => {
    const dir = tempDir("reads");
    writeFiles(dir, { "ok.txt": "hi", "big.txt": "x".repeat(MAX_TARGET_FILE_BYTES + 1) });
    mkdirSync(join(dir, "sub"));
    expect(readRegularFile(join(dir, "ok.txt"))?.text).toBe("hi");
    expect(readRegularFile(join(dir, "big.txt"))).toBeUndefined();
    expect(readRegularFile(join(dir, "sub"))).toBeUndefined();
    expect(readRegularFile(join(dir, "missing"))).toBeUndefined();
  });

  test.skipIf(process.platform === "win32")("a fifo is refused without blocking", () => {
    const dir = tempDir("fifo");
    const fifo = join(dir, "pipe");
    expect(Bun.spawnSync(["mkfifo", fifo]).exitCode).toBe(0);
    expect(readRegularFile(fifo)).toBeUndefined();
    rmSync(fifo);
  });
});

describe("/api/lsp/file authorization", () => {
  test("is by exact spelling: an allowed path does not allow another casing of it", async () => {
    const root = tempDir("auth");
    writeFiles(root, { "a.ts": "x\n", "util.ts": "u\n" });
    const { harness } = setup(root, { responses: { "textDocument/definition": at(fileUri(root, "util.ts")) } });
    await harness.post("/api/lsp/definition", where());
    const get = (uri: string) => harness.get(`/api/lsp/file?uri=${encodeURIComponent(uri)}`);
    expect((await get(fileUri(root, "util.ts"))).status).toBe(200);
    expect((await get(fileUri(root, "UTIL.TS"))).status).toBe(403);
  });
});
