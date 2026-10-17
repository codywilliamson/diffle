import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { collectDiff, gitExcludePath, isIgnored, repoName, resolveRef } from "../src/utils/git";
import { parseDiff } from "../src/core/diffParser";

function git(args: string[], cwd: string): void {
  Bun.spawnSync(["git", ...args], { cwd });
}

let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "nittle-git-"));
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.name", "t"], repo);
  git(["config", "user.email", "t@e.com"], repo);
  writeFileSync(join(repo, "tracked.txt"), "one\n");
  git(["add", "-A"], repo);
  git(["commit", "-q", "-m", "init"], repo);
  git(["update-ref", "refs/remotes/origin/feature/remote-only", "HEAD"], repo);
  git(["branch", "feature/local", "HEAD"], repo);
  git(["update-ref", "refs/remotes/origin/feature/local", "HEAD"], repo);
  writeFileSync(join(repo, "tracked.txt"), "one\ntwo\n"); // modify a tracked file
  writeFileSync(join(repo, "fresh.txt"), "brand new\n"); // brand-new untracked file
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("collectDiff", () => {
  it("includes untracked files as added when requested", () => {
    const files = parseDiff(collectDiff(["diff", "HEAD"], repo, true), "wt").files;
    const paths = files.map((f) => f.path);
    expect(paths).toContain("tracked.txt");
    expect(paths).toContain("fresh.txt");
    const fresh = files.find((f) => f.path === "fresh.txt");
    expect(fresh?.changeType).toBe("added");
    expect(fresh?.additions).toBe(1);
  });

  it("omits untracked files when not requested", () => {
    const paths = parseDiff(collectDiff(["diff", "HEAD"], repo, false), "wt").files.map((f) => f.path);
    expect(paths).toContain("tracked.txt");
    expect(paths).not.toContain("fresh.txt");
  });

  it("hides nittle's own .review file by default", () => {
    writeFileSync(join(repo, ".review"), "{}\n");
    try {
      const paths = parseDiff(collectDiff(["diff", "HEAD"], repo, true), "wt").files.map((f) => f.path);
      expect(paths).toContain("fresh.txt");
      expect(paths).not.toContain(".review");
    } finally {
      rmSync(join(repo, ".review"), { force: true });
    }
  });

  // `--exclude-standard` drops an excluded .review, so opting in has to add it back by hand.
  it("surfaces .review when the user opts in, even once git excludes it", () => {
    writeFileSync(join(repo, ".review"), "{}\n");
    writeFileSync(join(repo, ".git", "info", "exclude"), ".review\n");
    try {
      const paths = parseDiff(collectDiff(["diff", "HEAD"], repo, true, true), "wt").files.map((f) => f.path);
      expect(paths).toContain(".review");
      expect(paths.filter((p) => p === ".review")).toHaveLength(1);
    } finally {
      rmSync(join(repo, ".review"), { force: true });
      writeFileSync(join(repo, ".git", "info", "exclude"), "");
    }
  });

  it("does not add .review twice when it is untracked and not yet excluded", () => {
    writeFileSync(join(repo, ".review"), "{}\n");
    try {
      const paths = parseDiff(collectDiff(["diff", "HEAD"], repo, true, true), "wt").files.map((f) => f.path);
      expect(paths.filter((p) => p === ".review")).toHaveLength(1);
    } finally {
      rmSync(join(repo, ".review"), { force: true });
    }
  });
});

describe("isIgnored / gitExcludePath", () => {
  it("reports git's exclude rules", () => {
    writeFileSync(join(repo, ".git", "info", "exclude"), "ignored.txt\n");
    try {
      expect(isIgnored("ignored.txt", repo)).toBe(true);
      expect(isIgnored("tracked.txt", repo)).toBe(false);
    } finally {
      writeFileSync(join(repo, ".git", "info", "exclude"), "");
    }
  });

  it("resolves the per-clone exclude path inside a repo and null outside one", () => {
    expect(gitExcludePath(repo)).toContain("info/exclude");
    expect(gitExcludePath(tmpdir())).toBeNull();
  });
});

describe("repoName", () => {
  it("falls back to the folder name without an origin remote", () => {
    expect(repoName(repo)).toBe(basename(repo));
  });
});

describe("resolveRef meta", () => {
  it("default working-tree plan surfaces untracked files", () => {
    const plan = resolveRef(undefined, repo);
    expect(plan.mode).toBe("working tree");
    expect(plan.source).toBe("working tree");
    expect(plan.target).toBe("main");
    expect(plan.includeUntracked).toBe(true);
  });

  it("treats literal HEAD as the working tree comparison", () => {
    const plan = resolveRef("HEAD", repo);
    expect(plan.diffArgs).toEqual(["diff", "HEAD"]);
    expect(plan.mode).toBe("working tree");
    expect(plan.newRef).toBeNull();
    expect(plan.includeUntracked).toBe(true);
  });

  it("staged plan does not surface untracked files", () => {
    const plan = resolveRef("staged", repo);
    expect(plan.mode).toBe("staged");
    expect(plan.includeUntracked).toBe(false);
  });

  it("falls back to an origin branch when the local ref is missing", () => {
    const plan = resolveRef("feature/remote-only", repo);
    expect(plan.diffArgs).toEqual(["diff", "origin/feature/remote-only...HEAD"]);
    expect(plan.refLabel).toBe("main → origin/feature/remote-only");
    expect(plan.target).toBe("origin/feature/remote-only");
  });

  it("prefers an exact local ref over the origin fallback", () => {
    const plan = resolveRef("feature/local", repo);
    expect(plan.diffArgs).toEqual(["diff", "feature/local...HEAD"]);
    expect(plan.target).toBe("feature/local");
  });

  it("falls back to origin for refs inside a range", () => {
    const plan = resolveRef("feature/remote-only..HEAD", repo);
    expect(plan.diffArgs).toEqual(["diff", "origin/feature/remote-only..HEAD"]);
    expect(plan.newRef).toBe("HEAD");
    expect(plan.source).toBe("origin/feature/remote-only");
  });
});
