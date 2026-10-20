// issue #318: a working-tree review (dirty checkout, base = HEAD) answers old-side definitions from
// a detached worktree at HEAD, with the base commit's path, line numbers and the side marked "old".
// real typescript-language-server on the lsp-ts fixture; skipped when it is not on PATH.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { findExecutable } from "../src/core/lsp/which";
import { diffFile, startHarness, type Harness } from "./helpers/lspHttp";
import { positionOf, prepareLspFixture } from "./helpers/lspFixture";

const server = findExecutable("typescript-language-server").path;
const SLOW_MS = 90_000;

const git = (cwd: string, ...args: string[]): void => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};

describe.skipIf(!server)("old-side definition in a working-tree review (real typescript-language-server)", () => {
  let root = "";
  let baseGreeter = "";
  let pool: LspPool;
  let harness: Harness | undefined;
  beforeAll(() => {
    root = prepareLspFixture(server!);
    writeFileSync(join(root, ".gitignore"), "node_modules\n");
    git(root, "init", "-q", "-b", "main");
    git(root, "add", ".");
    git(root, "commit", "-qm", "base");
    baseGreeter = readFileSync(join(root, "src", "greeter.ts"), "utf8");
    writeFileSync(join(root, "src", "greeter.ts"), "// added above everything\n" +baseGreeter.replace("${name}`", "${name}!`"));
    pool = new LspPool({ root, shutdownTimeoutMs: 5000 });
  });
  afterAll(async () => {
    harness?.stop();
    await pool?.shutdown();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("a removed-line token resolves to the base file's own line, not the working copy's", async () => {
    harness = startHarness(root, pool, [diffFile("src/greeter.ts", [1, 6])], null);
    harness.ctx.diffArgs = ["diff", "HEAD"];
    // base greeter.ts: `name` is used on line 5 and declared on line 4; the working copy shifted both down by one
    const res = await harness.post("/api/lsp/definition", { path: "src/greeter.ts", side: "old", ...positionOf(baseGreeter, "name}", 0) });
    const body = (await res.json()) as any;
    if (res.status === 409 && pool.status(["typescript"])[0]?.stderr?.includes("Volta error")) return;
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.targets).toHaveLength(1);
    expect(body.targets[0]).toMatchObject({ path: "src/greeter.ts", side: "old", range: { start: { line: 4 } } });
    expect(body.targets[0].absolutePath.startsWith(root)).toBe(false);
  }, SLOW_MS);
});
