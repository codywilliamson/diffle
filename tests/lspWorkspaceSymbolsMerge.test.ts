// gS across servers (#326): typescript and go both ready, and a query both of them answer.

import { afterEach, describe, expect, test } from "bun:test";
import { LspPool } from "../src/core/lsp/pool";
import { MAX_WORKSPACE_SYMBOLS } from "../src/server/lspSymbols";
import { FAKE_LSP_PATH, fakeEntry, tempDir } from "./helpers/fakeLspPool";
import { diffFile, fileUri, startHarness, writeFiles, type Harness } from "./helpers/lspHttp";

const SEARCH_TEST_TIMEOUT_MS = 15_000;
const searchTest = (name: string, run: () => Promise<void>) => test(name, run, SEARCH_TEST_TIMEOUT_MS);
const harnesses: Harness[] = [];
const pools: LspPool[] = [];
afterEach(() => {
  for (const h of harnesses.splice(0)) h.stop();
  for (const p of pools.splice(0)) p.killAll();
});

const range = (line: number, from: number, to: number) => ({ start: { line, character: from }, end: { line, character: to } });
const sym = (name: string, uri: string, line = 1, from = 0) => ({ name, kind: 12, location: { uri, range: range(line, from, from + name.length) } });
const entry = (config: object) => ({ ...fakeEntry(), candidates: [{ command: process.execPath, args: () => [FAKE_LSP_PATH, JSON.stringify(config)] }] });
const answers = (...symbols: unknown[]) => ({ responses: { "workspace/symbol": symbols } });

async function twoServers(root: string, ts: object, go: object, diff: string[]) {
  const pool = new LspPool({ root, registry: { typescript: entry(ts), go: entry(go) }, shutdownTimeoutMs: 500 });
  pools.push(pool);
  await pool.ensure("typescript");
  await pool.ensure("go"); // both ready before the search, whether or not the diff has a .go file
  const harness = startHarness(root, pool, diff.map((path) => diffFile(path)));
  harnesses.push(harness);
  const search = async (query: string) => await (await harness.get(`/api/lsp/symbols?query=${query}`)).json() as any;
  return { search };
}

describe("workspace symbols across ready servers", () => {
  searchTest("a go server that is ready but not in the diff still contributes", async () => {
    const root = tempDir("ws2");
    writeFiles(root, { "a.ts": "x\n", "util.go": "package util\n" });
    const ts = answers(sym("containsPath", fileUri(root, "a.ts")));
    const go = answers(sym("ContainsPath", fileUri(root, "util.go")));
    const { search } = await twoServers(root, ts, go, ["a.ts"]);
    const body = await search("ContainsPath");
    expect(body.symbols.map((s: any) => s.name).sort()).toEqual(["ContainsPath", "containsPath"]);
  });

  searchTest("a chatty server cannot push the other one's symbols past the cap", async () => {
    const root = tempDir("ws2");
    writeFiles(root, { "a.ts": "x\n", "util.go": "package util\n" });
    const many = Array.from({ length: MAX_WORKSPACE_SYMBOLS + 20 }, (_, i) => sym(`containsPath${i}`, fileUri(root, "a.ts"), 0, i));
    const go = answers(sym("ContainsPath", fileUri(root, "util.go")));
    const { search } = await twoServers(root, answers(...many), go, ["a.ts", "util.go"]);
    const body = await search("ContainsPath");
    expect(body.truncated).toBe(true);
    expect(body.symbols.map((s: any) => s.name)).toContain("ContainsPath");
  });

  // each cold server waits ~2s for project-load progress, so one search is ~2.5s; two in one test
  // would brush bun's 5s default, and a timeout mid-fetch tears the harness down as ECONNRESET
  searchTest("a slow server is waited for", async () => {
    const root = tempDir("ws2");
    writeFiles(root, { "a.ts": "x\n", "util.go": "package util\n" });
    const ts = { ...answers(sym("containsPath", fileUri(root, "a.ts"))), delay: { "workspace/symbol": 400 } };
    const { search } = await twoServers(root, ts, answers(sym("ContainsPath", fileUri(root, "util.go"))), ["a.ts", "util.go"]);
    expect((await search("ContainsPath")).symbols).toHaveLength(2);
  });

  searchTest("a failing server is skipped", async () => {
    const root = tempDir("ws2");
    writeFiles(root, { "a.ts": "x\n", "util.go": "package util\n" });
    const { search } = await twoServers(root, answers(sym("containsPath", fileUri(root, "a.ts"))), {}, ["a.ts", "util.go"]);
    expect((await search("ContainsPath")).symbols.map((s: any) => s.name)).toEqual(["containsPath"]);
  });

  searchTest("the same symbol from two servers collapses on uri, range and name", async () => {
    const root = tempDir("ws2");
    writeFiles(root, { "a.ts": "x\n" });
    const shared = sym("Shared", fileUri(root, "a.ts"), 1, 2);
    const moved = sym("Shared", fileUri(root, "a.ts"), 5, 2);
    const { search } = await twoServers(root, answers(shared, moved), answers(shared), ["a.ts"]);
    const body = await search("Shared");
    expect(body).toMatchObject({ total: 2 });
    expect(body.symbols.map((s: any) => s.range.start.line)).toEqual([2, 6]);
  });
});
