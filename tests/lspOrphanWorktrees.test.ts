// `nittle cleanup` removes detached worktrees a killed run left behind, and nothing else.

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findOrphanWorktrees, removeOrphanWorktrees } from "../src/core/lsp/orphanWorktrees";
import { WORKTREE_PREFIX } from "../src/core/lsp/workspace";
import { writeOwnership, type Ownership } from "../src/core/lsp/worktreeOwnership";
import { listWorktreePaths } from "../src/utils/gitWorktree";
import { gitRepo } from "./helpers/lspHttp";

const SLOW_MS = 60_000; // a worktree add is a real checkout
const git = (cwd: string, ...args: string[]) => {
  const proc = Bun.spawnSync(["git", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};
const deadPid = (): number => { const proc = Bun.spawnSync([process.execPath, "--version"]); return proc.pid; };
const norm = (path: string) => realpathSync.native(path).replaceAll("\\", "/").toLowerCase();

interface Made { path: string; dir: string }
// a worktree in <parent>/<dirName>/<leaf>, with an ownership note unless `note` is false
function make(repo: string, dirName: string, options: { leaf?: string; note?: Partial<Ownership> | false; parent?: string } = {}): Made {
  const dir = mkdtempSync(join(options.parent ?? tmpdir(), dirName));
  const path = join(dir, options.leaf ?? "new");
  git(repo, "worktree", "add", "--detach", path, "HEAD");
  if (options.note !== false) writeOwnership(dir, { pid: Number(/-(\d+)-/.exec(dirName)?.[1]), repo, worktrees: [path], links: [], ...options.note });
  return { path, dir };
}

const KILLED = join(import.meta.dir, "fixtures", "killedWorkspace.ts");

// runs a workspace that dies at `stage`; returns the repo and the commit it was opening
function killedRun(stage: "add" | "link") {
  const repo = gitRepo({ "a.ts": "one\n", "package.json": "{}\n" });
  writeFileSync(join(repo, "a.ts"), "two\n");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-am", "two");
  const run = Bun.spawnSync([process.execPath, KILLED, repo, "HEAD~1", stage]);
  expect(run.exitCode).toBe(137);
  return repo;
}

describe("a run killed mid-creation", () => {
  test("killed right before the worktree was added: cleanup removes the planned, empty directory", () => {
    const repo = killedRun("add");
    const found = findOrphanWorktrees(repo);
    expect(found).toHaveLength(1);
    expect(existsSync(found[0]!.dir)).toBe(true);
    expect(listWorktreePaths(repo)).toHaveLength(1);
    expect(removeOrphanWorktrees(repo, found)).toHaveLength(1);
    expect(existsSync(found[0]!.dir)).toBe(false);
  }, SLOW_MS);

  test("killed right after git worktree add, before linking: cleanup removes the registered worktree", () => {
    const repo = killedRun("link");
    const found = findOrphanWorktrees(repo);
    expect(found).toHaveLength(1);
    expect(listWorktreePaths(repo)).toHaveLength(2);
    expect(removeOrphanWorktrees(repo, found)).toHaveLength(1);
    expect(listWorktreePaths(repo)).toHaveLength(1);
    expect(existsSync(found[0]!.dir)).toBe(false);
  }, SLOW_MS);
});

describe("leftover worktrees", () => {
  test("only provably owned, dead-pid worktrees under the product prefix in this repo's list are removed", () => {
    const repo = gitRepo({ "a.ts": "x\n" });
    const dead = make(repo, `${WORKTREE_PREFIX}${deadPid()}-`);
    const live = make(repo, `${WORKTREE_PREFIX}${process.pid}-`);
    const noNote = make(repo, `${WORKTREE_PREFIX}${deadPid()}-`, { note: false });
    const otherRepo = make(repo, `${WORKTREE_PREFIX}${deadPid()}-`, { note: { repo: tmpdir() } });
    const oddLeaf = make(repo, `${WORKTREE_PREFIX}${deadPid()}-`, { leaf: "precious" });
    const lookalike = make(repo, `other-lsp-wt-${deadPid()}-`);
    const elsewhere = make(repo, `${WORKTREE_PREFIX}${deadPid()}-`, { parent: mkdtempSync(join(tmpdir(), "elsewhere-")) });
    const strangerRepo = gitRepo({ "b.ts": "y\n" });
    const stranger = make(strangerRepo, `${WORKTREE_PREFIX}${deadPid()}-`);

    const found = findOrphanWorktrees(repo);
    expect(found.map((orphan) => norm(orphan.dir))).toEqual([norm(dead.dir)]);

    expect(removeOrphanWorktrees(repo, found)).toHaveLength(1);
    expect(existsSync(dead.path)).toBe(false);
    expect(existsSync(dead.dir)).toBe(false); // the parent goes once it is empty
    for (const kept of [live, noNote, otherRepo, oddLeaf, lookalike, elsewhere, stranger]) expect(existsSync(kept.path)).toBe(true);
    expect(listWorktreePaths(repo)).toHaveLength(7); // the checkout + the six kept
    expect(listWorktreePaths(strangerRepo)).toHaveLength(2);
  }, SLOW_MS);

  test("a dependency link is unlinked as a link; the user's node_modules is left byte for byte", () => {
    const repo = gitRepo({ "a.ts": "x\n" });
    const user = mkdtempSync(join(tmpdir(), "user-modules-"));
    mkdirSync(join(user, "pkg"));
    writeFileSync(join(user, "pkg", "index.d.ts"), "keep me\n");
    const owned = make(repo, `${WORKTREE_PREFIX}${deadPid()}-`);
    const link = join(owned.path, "node_modules");
    symlinkSync(user, link, "junction");
    writeOwnership(owned.dir, { pid: Number(/-(\d+)-/.exec(owned.dir)?.[1]), repo, worktrees: [owned.path], links: [link] });

    expect(removeOrphanWorktrees(repo, findOrphanWorktrees(repo))).toHaveLength(1);
    expect(existsSync(owned.path)).toBe(false);
    expect(readFileSync(join(user, "pkg", "index.d.ts"), "utf8")).toBe("keep me\n");
    rmSync(user, { recursive: true, force: true });
  }, SLOW_MS);

  test("a registration whose directory is gone is not ours to prune", () => {
    const repo = gitRepo({ "a.ts": "x\n" });
    const gone = make(repo, `${WORKTREE_PREFIX}${deadPid()}-`);
    rmSync(gone.dir, { recursive: true, force: true });
    expect(findOrphanWorktrees(repo)).toEqual([]);
    removeOrphanWorktrees(repo, []);
    expect(listWorktreePaths(repo)).toHaveLength(2);
  }, SLOW_MS);

  test("worktree paths with spaces and non-ascii characters list unquoted", () => {
    const repo = gitRepo({ "a.ts": "x\n" });
    const odd = make(repo, "nittle odd ünï ", { note: false });
    expect(listWorktreePaths(repo).map(norm)).toContain(norm(odd.path));
  }, SLOW_MS);
});
