import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LspStatusResponse } from "../src/types";
import { LspPool } from "../src/core/lsp/pool";
import { launchReview, type ReviewLaunch } from "../src/core/reviewLaunch";
import { listSessions } from "../src/core/sessions";
import { fakeEntry, fakePool, isAlive, scriptFake, waitFor } from "./helpers/fakeLspPool";

const git = (args: string[], cwd: string) => Bun.spawnSync(["git", ...args], { cwd });
const root = join(import.meta.dir, "..");
let repo: string;
let data: string;
const launches: ReviewLaunch[] = [];

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "nittle-lsp-repo-"));
  data = mkdtempSync(join(tmpdir(), "nittle-lsp-data-"));
  process.env.NITTLE_DATA_DIR = data;
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.name", "t"], repo); git(["config", "user.email", "t@e.com"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 1;\n"); writeFileSync(join(repo, "b.md"), "# b\n");
  git(["add", "-A"], repo); git(["commit", "-q", "-m", "init"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 2;\n");
});
afterEach(() => { for (const launch of launches.splice(0)) launch.stop(); delete process.env.FAKE_LSP; });
afterAll(() => { delete process.env.NITTLE_DATA_DIR; rmSync(repo, { recursive: true, force: true }); rmSync(data, { recursive: true, force: true }); });

function launch(input: { lsp?: boolean; lspPool?: LspPool }): { base: string; launch: ReviewLaunch } {
  const started = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp", ...input });
  launches.push(started);
  return { base: started.url.split("/?")[0]!, launch: started };
}
const status = (base: string) => fetch(`${base}/api/lsp/status`).then((res) => res.json()) as Promise<LspStatusResponse>;
const missingPool = () => new LspPool({ root: repo, registry: { typescript: { ...fakeEntry(), candidates: [{ command: "nittle-no-such-server", args: () => [] }] } } });

describe("GET /api/lsp/status", () => {
  it("reports a missing server quietly: no errors, no stderr, nothing started", async () => {
    const errors = spyOn(console, "error"); const warns = spyOn(console, "warn"); const stderr = spyOn(process.stderr, "write");
    const { base } = launch({ lspPool: missingPool() });
    const body = await status(base);
    expect(body.enabled).toBe(true);
    expect(body.languages).toEqual([{ language: "typescript", state: "missing", restarts: 0, hint: "install the fake" }]);
    expect(errors).not.toHaveBeenCalled(); expect(warns).not.toHaveBeenCalled(); expect(stderr).not.toHaveBeenCalled();
    errors.mockRestore(); warns.mockRestore(); stderr.mockRestore();
  });

  it("lists only languages present in the diff, and asking never starts a server", async () => {
    scriptFake({});
    const { base } = launch({ lspPool: fakePool(repo) });
    const body = await status(base);
    expect(body.languages.map((item) => [item.language, item.state])).toEqual([["typescript", "idle"]]);
  });

  it("--no-lsp: enabled is false and nothing is listed or started", async () => {
    const { base, launch: started } = launch({ lsp: false });
    expect(await status(base)).toEqual({ enabled: false, languages: [] });
    expect(await started.server.port).toBeGreaterThan(0);
  });

  it("reflects a running server as ready", async () => {
    scriptFake({});
    const pool = fakePool(repo);
    const { base } = launch({ lspPool: pool });
    await pool.ensure("typescript");
    expect((await status(base)).languages[0]?.state).toBe("ready");
  });
});

describe("lsp servers stop with the viewer", () => {
  it("stop() (ctrl+c, process exit, mcp stopAll) kills a running server", async () => {
    scriptFake({ ignoreShutdown: true, ignoreExit: true });
    const pool = fakePool(repo);
    const { launch: started } = launch({ lspPool: pool });
    const pid = (await pool.ensure("typescript"))!.pid!;
    started.stop();
    await waitFor(() => !isAlive(pid));
  });

  it("the session-stop path (last tab closed) shuts the server down gracefully", async () => {
    scriptFake({});
    const pool = fakePool(repo);
    const { base, launch: started } = launch({ lspPool: pool });
    const pid = (await pool.ensure("typescript"))!.pid!;
    const entry = listSessions().find((item) => item.reviewId === started.review.id)!;
    const res = await fetch(`${base}/api/session/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: entry.sessionId }) });
    expect(res.status).toBe(200);
    await waitFor(() => !isAlive(pid));
    expect(pool.status(["typescript"])[0]?.state).not.toBe("ready");
  });

  it("never writes into the repository", async () => {
    scriptFake({});
    const pool = fakePool(repo);
    launch({ lspPool: pool });
    await pool.ensure("typescript");
    await pool.shutdown();
    expect(git(["status", "--porcelain", "--ignored"], repo).stdout.toString().trim()).toBe("M a.ts"); // only our own edit: no untracked or ignored leftovers
  });
});
