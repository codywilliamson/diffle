// a branch review against a real typescript-language-server: the checkout sits on another commit,
// yet go-to-definition lands in the branch's version of a file nobody opened. skipped without the
// server on PATH (CI installs it and sets REQUIRE_REAL_LSP).

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { findExecutable } from "../src/core/lsp/which";
import { diffFile, gitRepo, startHarness, type Harness } from "./helpers/lspHttp";
import { positionOf } from "./helpers/lspFixture";

const server = findExecutable("typescript-language-server").path;
const SLOW_MS = 90_000;
const MAIN_LIB = "export function greet(name: string): string {\n  return name;\n}\n";
const BRANCH_LIB = "// the branch added these\n// two lines\nexport function greet(name: string): string {\n  return name;\n}\n";
const MAIN_TS = 'import { greet } from "./lib";\n\ngreet("x");\n';

const git = (cwd: string, ...args: string[]): string => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
  return proc.stdout.toString().trim();
};

describe.skipIf(!server)("detached worktree (real typescript-language-server)", () => {
  const root = gitRepo({ "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }), "lib.ts": MAIN_LIB, "main.ts": MAIN_TS });
  const base = git(root, "rev-parse", "HEAD");
  writeFileSync(join(root, "lib.ts"), BRANCH_LIB);
  git(root, "commit", "-q", "-am", "branch change");
  const branch = git(root, "rev-parse", "HEAD");
  git(root, "checkout", "-q", "--detach", base); // the user's checkout is not on the reviewed commit
  const pool = new LspPool({ root, shutdownTimeoutMs: 5000 });
  let harness: Harness | undefined;
  afterAll(async () => {
    harness?.stop();
    await pool.shutdown();
    rmSync(root, { recursive: true, force: true });
  });

  test("go-to-definition resolves an unopened import to the branch's version", async () => {
    harness = startHarness(root, pool, [diffFile("main.ts", [3]), diffFile("lib.ts", [1, 2])], branch);
    harness.ctx.diffArgs = ["diff", `${base}..${branch}`];
    const res = await harness.post("/api/lsp/definition", { path: "main.ts", side: "new", ...positionOf(MAIN_TS, "greet(", 0) });
    const body = (await res.json()) as any;
    // the isolated test home hides the profile volta's node shim needs; nothing to assert then
    if (res.status === 409 && pool.status(["typescript"])[0]?.stderr?.includes("Volta error")) return;
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.targets[0]).toMatchObject({ path: "lib.ts", inRepo: true, inDiff: true, range: { start: { line: 3 } } });
    expect(body.targets[0].absolutePath.startsWith(root)).toBe(false);
  }, SLOW_MS);

  test("the old side resolves against the base commit", async () => {
    if (!harness) return;
    const res = await harness.post("/api/lsp/definition", { path: "main.ts", side: "old", ...positionOf(MAIN_TS, "greet(", 0) });
    const body = (await res.json()) as any;
    if (res.status === 409 && pool.status(["typescript"])[0]?.stderr?.includes("Volta error")) return;
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.targets[0]).toMatchObject({ path: "lib.ts", side: "old", range: { start: { line: 1 } } });
  }, SLOW_MS);
});
