import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, unlinkSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { workingTreeBlobs } from "../src/utils/gitBlobs";
import { captureRound, changedSinceRound, interdiffFor } from "../src/core/reviewRounds";

let repo: string;
const git = (...args: string[]) => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
  return proc.stdout.toString().trim();
};
const write = (file: string, body: string) => writeFileSync(join(repo, file), body);
const added = (file: { hunks: { lines: { type: string; content: string }[] }[] } | null) =>
  file?.hunks.flatMap((h) => h.lines).filter((l) => l.type === "addition").map((l) => l.content);

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "rounds-"));
  git("init", "-q");
  write("a.ts", "one\ntwo\n");
  write("b.ts", "same\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("working tree rounds", () => {
  it("shows only the edit made after the round", () => {
    write("a.ts", "one\ntwo\nthree\n");
    const round = captureRound(repo, null, ["a.ts", "b.ts"]);
    write("a.ts", "one\ntwo\nthree\nfour\n");
    const file = interdiffFor(round, "a.ts", repo, null);
    expect(file?.path).toBe("a.ts");
    expect(added(file)).toEqual(["four"]);
    expect(file?.changeType).toBe("modified");
    expect(interdiffFor(round, "b.ts", repo, null)).toBeNull();
    expect([...changedSinceRound(round, repo, null, ["a.ts", "b.ts"])]).toEqual(["a.ts"]);
  });

  it("handles files added and deleted after the round", () => {
    const round = captureRound(repo, null, ["a.ts", "new.ts"]);
    expect(round.blobs["new.ts"]).toBeNull();
    write("new.ts", "hello\n");
    const created = interdiffFor(round, "new.ts", repo, null);
    expect(created?.changeType).toBe("added");
    expect(added(created)).toEqual(["hello"]);
    unlinkSync(join(repo, "a.ts"));
    const removed = interdiffFor(round, "a.ts", repo, null);
    expect(removed?.changeType).toBe("deleted");
    expect(removed?.deletions).toBe(2);
  });
});

describe("staged and committed rounds", () => {
  it("diffs staged blobs", () => {
    write("a.ts", "one\nstaged\n");
    git("add", "a.ts");
    const round = captureRound(repo, "", ["a.ts", "b.ts"]);
    write("a.ts", "one\nstaged\nmore\n");
    git("add", "a.ts");
    expect(added(interdiffFor(round, "a.ts", repo, ""))).toEqual(["more"]);
    expect(interdiffFor(round, "b.ts", repo, "")).toBeNull();
  });

  it("diffs committed refs via rev-parse blobs", () => {
    const round = captureRound(repo, "HEAD", ["a.ts", "gone.ts"]);
    expect(round.blobs["a.ts"]).toBe(git("rev-parse", "HEAD:a.ts"));
    expect(round.blobs["gone.ts"]).toBeNull();
    write("a.ts", "one\ntwo\nthree\n");
    write("gone.ts", "x\n");
    git("add", ".");
    git("commit", "-q", "-m", "next");
    expect(added(interdiffFor(round, "a.ts", repo, "HEAD"))).toEqual(["three"]);
    expect(interdiffFor(round, "gone.ts", repo, "HEAD")?.changeType).toBe("added");
    expect(interdiffFor(round, "b.ts", repo, "HEAD")?.changeType).toBe("added");
  });
});

describe("working tree blob hashing", () => {
  const stored = (sha: string) => Bun.spawnSync(["git", "cat-file", "-e", sha], { cwd: repo }).exitCode === 0;

  it("does not write objects when only comparing", () => {
    write("a.ts", "unique content nobody committed\n");
    expect(changedSinceRound({ capturedAt: "", blobs: {} }, repo, null, ["a.ts"]).has("a.ts")).toBe(true);
    const sha = workingTreeBlobs(repo, ["a.ts"])["a.ts"]!;
    expect(sha).toMatch(/^[0-9a-f]{40,64}$/);
    expect(stored(sha)).toBe(false);
  });

  it("writes objects for captured rounds and the interdiff's current side", () => {
    write("a.ts", "captured\n");
    const round = captureRound(repo, null, ["a.ts"]);
    expect(stored(round.blobs["a.ts"]!)).toBe(true);
    write("a.ts", "captured\nafter\n");
    expect(added(interdiffFor(round, "a.ts", repo, null))).toEqual(["after"]);
  });

  it("treats symlinks as missing", () => {
    try {
      symlinkSync(join(tmpdir()), join(repo, "link.ts"));
    } catch {
      return; // no symlink permission on this machine
    }
    expect(workingTreeBlobs(repo, ["link.ts", "a.ts"], true)["link.ts"]).toBeNull();
    expect(workingTreeBlobs(repo, ["link.ts", "a.ts"], true)["a.ts"]).not.toBeNull();
  });
});
