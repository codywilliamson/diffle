import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchReview, type ReviewLaunch } from "../src/core/reviewLaunch";
import { listSessions } from "../src/core/sessions";
import { onShutdownSignals, SHUTDOWN_SIGNALS } from "../src/core/shutdownSignals";
import { fakePool, isAlive, scriptFake, waitFor } from "./helpers/fakeLspPool";

const git = (args: string[], cwd: string) => Bun.spawnSync(["git", ...args], { cwd });
const root = join(import.meta.dir, "..");
let repo: string;
let data: string;
const launches: ReviewLaunch[] = [];

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "nittle-signal-repo-"));
  data = mkdtempSync(join(tmpdir(), "nittle-signal-data-"));
  process.env.NITTLE_DATA_DIR = data;
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.name", "t"], repo); git(["config", "user.email", "t@e.com"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 1;\n");
  git(["add", "-A"], repo); git(["commit", "-q", "-m", "init"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 2;\n");
});
afterEach(() => { for (const launch of launches.splice(0)) launch.stop(); delete process.env.FAKE_LSP; });
afterAll(() => { delete process.env.NITTLE_DATA_DIR; rmSync(repo, { recursive: true, force: true }); rmSync(data, { recursive: true, force: true }); });

describe("shutdown signals", () => {
  it("covers ctrl+c, kill and terminal close everywhere, and ctrl+break on windows", () => {
    expect(SHUTDOWN_SIGNALS).toEqual(expect.arrayContaining(["SIGINT", "SIGTERM", "SIGHUP"]));
    expect(SHUTDOWN_SIGNALS.includes("SIGBREAK")).toBe(process.platform === "win32");
  });

  it("calls the handler once per signal and stops after the returned remover runs", () => {
    const host = new EventEmitter();
    const seen: string[] = [];
    const remove = onShutdownSignals((signal) => seen.push(signal), host);
    for (const signal of SHUTDOWN_SIGNALS) host.emit(signal, signal);
    expect(seen).toEqual([...SHUTDOWN_SIGNALS]);
    remove();
    for (const signal of SHUTDOWN_SIGNALS) host.emit(signal, signal);
    expect(seen).toHaveLength(SHUTDOWN_SIGNALS.length);
  });

  for (const signal of SHUTDOWN_SIGNALS) {
    it(`${signal} runs the review teardown: language server killed, session unregistered`, async () => {
      scriptFake({});
      const pool = fakePool(repo);
      const started = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "cli", lspPool: pool });
      launches.push(started);
      const bridge = await pool.ensure("typescript");
      const pid = bridge!.pid!;
      expect(isAlive(pid)).toBe(true);
      expect(listSessions().some((entry) => entry.reviewId === started.review.id)).toBe(true);

      const host = new EventEmitter();
      onShutdownSignals(() => started.stop(), host);
      host.emit(signal, signal);

      await waitFor(() => !isAlive(pid), 10_000);
      expect(listSessions().some((entry) => entry.reviewId === started.review.id)).toBe(false);
    });
  }
});
