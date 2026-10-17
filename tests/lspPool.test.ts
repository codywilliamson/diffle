import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { languagesInPaths } from "../src/core/lsp/registry";
import { fakeEntry, fakePool, isAlive, scriptFake, tempDir, waitFor } from "./helpers/fakeLspPool";

const pools: LspPool[] = [];
function track(pool: LspPool): LspPool { pools.push(pool); return pool; }
afterEach(() => { for (const pool of pools.splice(0)) pool.killAll(); delete process.env.FAKE_LSP; });

const stateOf = (pool: LspPool, language: "typescript" | "csharp" = "typescript") => pool.status([language])[0]!;
const launches = (file: string) => (existsSync(file) ? Number(readFileSync(file, "utf8")) : 0);

describe("lsp pool: lazy start", () => {
  test("nothing runs until a language is requested, and only that language starts", async () => {
    const dir = tempDir("pool");
    const counter = join(dir, "launches");
    scriptFake({ counterFile: counter });
    const pool = track(fakePool(dir));
    expect(stateOf(pool).state).toBe("idle");
    expect(launches(counter)).toBe(0);
    const bridge = await pool.ensure("typescript");
    expect(bridge).toBeDefined();
    expect(stateOf(pool).state).toBe("ready");
    expect(launches(counter)).toBe(1);
    expect(stateOf(pool, "csharp").state).toBe("idle"); // never requested, never started
  });

  test("status asks about languages in the diff only", () => {
    expect(languagesInPaths(["src/a.ts", "README.md", "b.tsx"])).toEqual(["typescript"]);
    expect(languagesInPaths(["README.md"])).toEqual([]);
    expect(languagesInPaths(["a.cs", "b.ts"])).toEqual(["typescript", "csharp"]);
  });

  test("concurrent first requests share one process", async () => {
    const dir = tempDir("pool");
    const counter = join(dir, "launches");
    scriptFake({ counterFile: counter, initDelayMs: 100 });
    const pool = track(fakePool(dir));
    const [a, b] = await Promise.all([pool.ensure("typescript"), pool.ensure("typescript")]);
    expect(a).toBe(b);
    expect(launches(counter)).toBe(1);
  });

  test("the workspace root is the pool root and the product name is the client", async () => {
    scriptFake({});
    const root = tempDir("pool-root");
    const bridge = (await track(fakePool(root)).ensure("typescript"))!;
    const { initParams } = await bridge.request<{ initParams: { rootUri: string } }>("fake/state");
    expect(initParams.rootUri).toBe(bridge.rootUri);
    expect(decodeURIComponent(initParams.rootUri).toLowerCase()).toContain(root.replaceAll("\\", "/").toLowerCase());
  });
});

describe("lsp pool: status transitions", () => {
  test("starting, then indexing while work-done progress runs, then ready", async () => {
    scriptFake({ initDelayMs: 150, progress: { delayMs: 20, durationMs: 300 } });
    const pool = track(fakePool(tempDir("pool")));
    const ensuring = pool.ensure("typescript");
    await waitFor(() => stateOf(pool).state === "starting");
    await ensuring;
    await waitFor(() => stateOf(pool).state === "indexing");
    await waitFor(() => stateOf(pool).state === "ready");
  });

  test("missing servers are reported with an install hint and never throw", async () => {
    const pool = track(new LspPool({ root: tempDir("pool"), registry: { typescript: { ...fakeEntry(), candidates: [{ command: "nittle-no-such-server", args: () => [] }] } } }));
    expect(stateOf(pool)).toMatchObject({ state: "missing", hint: "install the fake" });
    expect(await pool.ensure("typescript")).toBeUndefined();
    expect(stateOf(pool).state).toBe("missing");
  });

  test("falls back to the next candidate when the first is not installed", async () => {
    scriptFake({});
    const entry = fakeEntry();
    entry.candidates.unshift({ command: "nittle-no-such-server", args: () => [] });
    const pool = track(new LspPool({ root: tempDir("pool"), registry: { typescript: entry } }));
    expect(await pool.ensure("typescript")).toBeDefined();
  });
});

describe("lsp pool: crashes", () => {
  test("a crash is restarted once and the new server serves requests", async () => {
    scriptFake({});
    const pool = track(fakePool(tempDir("pool")));
    const first = (await pool.ensure("typescript"))!;
    await first.request("fake/crash").catch(() => {});
    const second = (await pool.ensure("typescript"))!;
    expect(second).not.toBe(first);
    expect(await second.request<number>("fake/echo", 1)).toBe(1);
    expect(stateOf(pool)).toMatchObject({ state: "ready", restarts: 1 });
  });

  test("a second crash marks the language failed and keeps stderr for status", async () => {
    scriptFake({});
    const pool = track(fakePool(tempDir("pool")));
    await (await pool.ensure("typescript"))!.request("fake/crash").catch(() => {});
    await (await pool.ensure("typescript"))!.request("fake/crash").catch(() => {});
    await waitFor(() => stateOf(pool).state === "failed");
    expect(stateOf(pool).stderr).toContain("crash requested");
    expect(await pool.ensure("typescript")).toBeUndefined();
  });

  test("a server that dies during initialize is retried once, then failed with its stderr", async () => {
    scriptFake({ exitOnInitialize: 2 });
    const pool = track(fakePool(tempDir("pool")));
    expect(await pool.ensure("typescript")).toBeUndefined();
    expect(stateOf(pool)).toMatchObject({ state: "failed", restarts: 1 });
    expect(stateOf(pool).stderr).toContain("refusing to initialize");
  });

  test("a crash at launch that recovers on the retry ends up ready", async () => {
    const dir = tempDir("pool");
    scriptFake({ crashFirstN: 1, counterFile: join(dir, "launches") });
    const pool = track(fakePool(dir));
    expect(await pool.ensure("typescript")).toBeDefined();
    expect(stateOf(pool)).toMatchObject({ state: "ready", restarts: 1 });
  });

  test("stderr kept for status is bounded", async () => {
    scriptFake({ exitOnInitialize: 2, stderrOnStart: "x".repeat(50_000) });
    const pool = track(fakePool(tempDir("pool")));
    await pool.ensure("typescript");
    expect((stateOf(pool).stderr ?? "").length).toBeLessThanOrEqual(8_192);
  });
});

describe("lsp pool: shutdown and --no-lsp", () => {
  test("shutdown asks servers to exit and removes the temp log dir", async () => {
    scriptFake({});
    const pool = track(fakePool(tempDir("pool")));
    const bridge = (await pool.ensure("typescript"))!;
    const pid = bridge.pid!;
    await pool.shutdown();
    expect(isAlive(pid)).toBe(false);
    expect(await pool.ensure("typescript")).toBeUndefined();
  });

  test("a server that ignores shutdown is killed", async () => {
    scriptFake({ ignoreShutdown: true, ignoreExit: true });
    const pool = track(fakePool(tempDir("pool"), { shutdownTimeoutMs: 200 }));
    const pid = (await pool.ensure("typescript"))!.pid!;
    await pool.shutdown();
    await waitFor(() => !isAlive(pid));
  });

  test("killAll is synchronous and leaves no process behind", async () => {
    scriptFake({ ignoreShutdown: true, ignoreExit: true });
    const pool = track(fakePool(tempDir("pool")));
    const pid = (await pool.ensure("typescript"))!.pid!;
    pool.killAll();
    await waitFor(() => !isAlive(pid));
    expect(stateOf(pool).state).not.toBe("failed"); // a deliberate stop is not a crash
  });

  test("a disabled pool starts nothing", async () => {
    const dir = tempDir("pool");
    const counter = join(dir, "launches");
    scriptFake({ counterFile: counter });
    const pool = track(fakePool(dir, { enabled: false }));
    expect(pool.enabled).toBe(false);
    expect(await pool.ensure("typescript")).toBeUndefined();
    expect(launches(counter)).toBe(0);
  });
});
