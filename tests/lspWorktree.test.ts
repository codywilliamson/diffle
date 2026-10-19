// detached worktrees for the lsp: non-checked-out revisions are served from a temp worktree, the
// worktree follows the review only while clean, and the user's checkout is never touched.

import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { LspPool } from "../src/core/lsp/pool";
import { WORKTREE_PREFIX } from "../src/core/lsp/workspace";
import { fakePool, scriptFake } from "./helpers/fakeLspPool";
import { diffFile, gitRepo, startHarness, writeFiles, type Harness } from "./helpers/lspHttp";

const harnesses: Harness[] = [];
const pools: LspPool[] = [];
afterEach(() => {
  for (const h of harnesses.splice(0)) h.stop();
  for (const p of pools.splice(0)) p.killAll();
  delete process.env.FAKE_LSP;
});

const git = (cwd: string, ...args: string[]): string => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "--no-optional-locks", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
  return proc.stdout.toString().trim();
};
const commitAll = (root: string, content: string): string => {
  writeFileSync(join(root, "a.ts"), content);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", content.trim());
  return git(root, "rev-parse", "HEAD");
};

function filesBelow(dir: string, root = dir): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(out, filesBelow(path, root));
    else out[relative(root, path)] = createHash("sha256").update(readFileSync(path)).digest("hex");
  }
  return out;
}

// everything the user could notice: HEAD, the raw index, the working tree and every ref
function snapshot(root: string) {
  return {
    head: git(root, "rev-parse", "HEAD"), headRef: git(root, "symbolic-ref", "-q", "HEAD"),
    index: createHash("sha256").update(readFileSync(join(root, ".git", "index"))).digest("hex"), staged: git(root, "ls-files", "--stage"),
    status: git(root, "status", "--porcelain"), files: filesBelow(root),
    refs: git(root, "for-each-ref"), branches: git(root, "branch", "-a", "--format=%(refname)"), worktrees: git(root, "worktree", "list", "--porcelain"),
  };
}

// a user's checkout in the middle of work: a dirty tracked file, a staged file, an untracked file
function userCheckout() {
  const root = gitRepo({ "a.ts": "export const v = 1;\n", "b.ts": "export const b = 1;\n" });
  const c1 = git(root, "rev-parse", "HEAD");
  const c2 = commitAll(root, "export const v = 2;\n");
  const c3 = commitAll(root, "export const v = 3;\n");
  writeFiles(root, { "b.ts": "export const b = 'dirty';\n", "staged.ts": "export {};\n", "untracked.txt": "u\n" });
  git(root, "add", "staged.ts");
  git(root, "status"); // settle the index once, so a later read-only status proves nothing wrote it
  return { root, c1, c2, c3 };
}

function session(root: string, newRef: string | null, diffArgs: string[]) {
  scriptFake({ responses: { "textDocument/hover": null } });
  const pool = fakePool(root);
  pools.push(pool);
  const harness = startHarness(root, pool, [diffFile("a.ts")], newRef);
  harness.ctx.diffArgs = diffArgs;
  harnesses.push(harness);
  const hover = async (side: "new" | "old") => (await harness.post("/api/lsp/hover", { path: "a.ts", side, line: 1, character: 0 })).status;
  const refresh = (ref: string | null) => { harness.ctx.newRef = ref; harness.ctx.diffGeneration = (harness.ctx.diffGeneration ?? 0) + 1; };
  const status = async () => (await (await harness.get("/api/lsp/status")).json()) as { blocker?: string };
  // path -> text of every document any server holds open
  const openDocs = async () => {
    const docs: Record<string, string> = {};
    for (const bridge of pool.running()) {
      const state = (await bridge.request("fake/state")) as { docs: Record<string, { text: string }> };
      for (const [uri, doc] of Object.entries(state.docs)) docs[fileURLToPath(uri)] = doc.text.replace(/\r\n/g, "\n"); // autocrlf checkouts
    }
    return docs;
  };
  return { pool, harness, hover, refresh, status, openDocs };
}

const worktreeDirs = (docs: Record<string, string>) => Object.keys(docs).filter((path) => dirname(dirname(path)).includes(WORKTREE_PREFIX) || dirname(path).includes(WORKTREE_PREFIX));

describe("detached worktrees", () => {
  test("a full session leaves HEAD, the index, the working tree and the refs byte-identical", async () => {
    const { root, c1, c2, c3 } = userCheckout();
    const before = snapshot(root);
    const s = session(root, c2, ["diff", `${c1}..${c2}`]);

    // new side at c2 and old side at c1 come from two worktrees, never from the checkout
    expect(await s.hover("new")).toBe(200);
    expect(await s.hover("old")).toBe(200);
    let docs = await s.openDocs();
    expect(Object.keys(docs).some((path) => path.startsWith(root))).toBe(false);
    const [newPath] = Object.keys(docs).filter((path) => docs[path] === "export const v = 2;\n");
    const [oldPath] = Object.keys(docs).filter((path) => docs[path] === "export const v = 1;\n");
    expect(newPath && oldPath && newPath !== oldPath).toBe(true);
    expect(git(root, "worktree", "list", "--porcelain").replaceAll("\\", "/").toLowerCase()).toContain(dirname(newPath!).replaceAll("\\", "/").toLowerCase());
    const warm = await s.pool.view(dirname(newPath!)).ensure("typescript");

    // the review moves to c3: the clean worktree follows, at the same path
    s.refresh(c3);
    expect(await s.hover("new")).toBe(200);
    docs = await s.openDocs();
    expect(docs[newPath!]).toBe("export const v = 3;\n");
    expect((await s.status()).blocker).toBeUndefined();

    // a dirty worktree stays where it is and says why
    writeFileSync(newPath!, "export const v = 'scratch';\n");
    s.refresh(c1);
    expect(await s.hover("new")).toBe(200);
    expect((await s.status()).blocker).toContain("local changes");
    git(dirname(newPath!), "checkout", "--", "a.ts"); // throw the scratch edit away
    s.refresh(c1);
    expect(await s.hover("new")).toBe(200);
    expect((await s.status()).blocker).toBeUndefined();
    expect((await s.openDocs())[newPath!]).toBe("export const v = 1;\n");

    // back on the working tree, then on the worktree again: the warm server comes back
    s.refresh(null);
    expect(await s.hover("new")).toBe(200);
    expect(Object.keys(await s.openDocs()).some((path) => path.startsWith(root))).toBe(true);
    s.refresh(c2);
    expect(await s.hover("new")).toBe(200);
    expect(await s.pool.view(dirname(newPath!)).ensure("typescript")).toBe(warm);

    await s.pool.shutdown();
    expect(existsSync(dirname(dirname(newPath!)))).toBe(false);
    expect(snapshot(root)).toEqual(before);
  }, 30_000);

  test("killAll removes the worktrees too (ctrl+c and exit handlers)", async () => {
    const { root, c1, c2 } = userCheckout();
    const before = snapshot(root);
    const s = session(root, c2, ["diff", `${c1}..${c2}`]);
    expect(await s.hover("new")).toBe(200);
    expect(git(root, "worktree", "list", "--porcelain")).not.toBe(before.worktrees);
    s.pool.killAll();
    expect(snapshot(root)).toEqual(before);
  }, 30_000);

  test("HEAD with a dirty checkout gets a worktree; with a clean one it uses the root", async () => {
    const { root } = userCheckout();
    const dirty = session(root, "HEAD", ["diff", "main...HEAD"]);
    expect(await dirty.hover("new")).toBe(200);
    expect(worktreeDirs(await dirty.openDocs())).toHaveLength(1);
    await dirty.pool.shutdown();

    const clean = gitRepo({ "a.ts": "export const v = 1;\n" });
    const same = session(clean, "HEAD", ["diff", "HEAD~0"]);
    expect(await same.hover("new")).toBe(200);
    expect(worktreeDirs(await same.openDocs())).toHaveLength(0);
    expect(git(clean, "worktree", "list", "--porcelain").split("\n").filter((line) => line.startsWith("worktree "))).toHaveLength(1);
  }, 30_000);

  test("a review with no base commit still refuses the old side", async () => {
    const root = gitRepo({ "a.ts": "x\n" });
    const s = session(root, null, []);
    const res = await s.harness.post("/api/lsp/hover", { path: "a.ts", side: "old", line: 1, character: 0 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "old-side-unsupported", hint: expect.stringContaining("no base commit") });
    expect(s.pool.running()).toHaveLength(0);
  });
});
