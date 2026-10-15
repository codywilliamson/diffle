import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countLines, newSideLineCounts } from "../src/utils/gitBlobs";
import { withLineCounts } from "../src/core/lineCounts";
import type { DiffFile } from "../src/types";

let repo: string;
const git = (...args: string[]) => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};
const write = (file: string, body: string) => writeFileSync(join(repo, file), body);

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "line-counts-"));
  git("init", "-q");
  write("a.ts", "one\ntwo\nthree\n");
  write("my file.ts", "x\ny");
  write("ü.ts", "ä\nö\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("countLines", () => {
  it("counts lines as the client splits them", () => {
    const count = (text: string) => countLines(Buffer.from(text));
    expect(count("")).toBe(0);
    expect(count("a")).toBe(1);
    expect(count("a\n")).toBe(1);
    expect(count("a\r\nb\r\n")).toBe(2);
    expect(count("a\n\n")).toBe(2);
  });
});

describe("newSideLineCounts", () => {
  const paths = ["a.ts", "my file.ts", "ü.ts", "missing.ts"];

  it("reads every path of a ref in one batch, multibyte and spaced names included", () => {
    write("a.ts", "changed\n"); // the working tree must not leak into a ref read
    expect(newSideLineCounts(repo, "HEAD", paths)).toEqual({ "a.ts": 3, "my file.ts": 2, "ü.ts": 2, "missing.ts": null });
  });

  it("reads the working tree for a null ref and skips symlinks", () => {
    write("a.ts", "1\n2\n3\n4\n");
    symlinkSync(join(repo, "a.ts"), join(repo, "link.ts"));
    expect(newSideLineCounts(repo, null, [...paths, "link.ts"])).toEqual({ "a.ts": 4, "my file.ts": 2, "ü.ts": 2, "missing.ts": null, "link.ts": null });
  });
});

describe("withLineCounts", () => {
  const file = (path: string, over: Partial<DiffFile> = {}): DiffFile => ({
    path, oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [{ header: "@@ -1 +1 @@", lines: [] }], ...over,
  });

  it("stamps changed files and leaves deleted, hunkless and unreadable ones alone", () => {
    const diff = withLineCounts({ ref: "HEAD", files: [file("a.ts"), file("ü.ts", { changeType: "deleted" }), file("my file.ts", { hunks: [] }), file("missing.ts")] }, repo, "HEAD");
    expect(diff.files.map((f) => f.lineCount)).toEqual([3, undefined, undefined, undefined]);
  });

  it("keeps the diff when git fails", () => {
    const diff = { ref: "x", files: [file("a.ts")] };
    expect(withLineCounts(diff, join(repo, "not-here"), "HEAD")).toEqual(diff);
  });
});
