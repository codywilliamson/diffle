import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileChurn, MAX_PATHSPEC_CHARS } from "../src/core/analysis/churn";

let repo: string;
const git = (...args: string[]) => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};
const commit = (file: string, body: string) => {
  writeFileSync(join(repo, file), body);
  git("add", ".");
  git("commit", "-q", "-m", `edit ${file}`);
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "churn-"));
  git("init", "-q");
  commit("a.ts", "1");
  commit("a.ts", "2");
  commit("b.ts", "1");
  commit("a.ts", "3");
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("fileChurn", () => {
  it("counts commits per requested path", () => {
    expect(fileChurn(["a.ts", "b.ts", "c.ts"], repo)).toEqual({ "a.ts": 3, "b.ts": 1, "c.ts": 0 });
  });
  it("excludes commits after the given ref", () => {
    expect(fileChurn(["a.ts"], repo, "HEAD~1")["a.ts"]).toBe(2);
  });
  it("returns zeros on git failure", () => {
    expect(fileChurn(["a.ts"], repo, "nope")).toEqual({ "a.ts": 0 });
    expect(fileChurn(["a.ts"], tmpdir())).toEqual({ "a.ts": 0 });
  });
  it("treats pathspec characters literally", () => {
    expect(fileChurn(["*.ts", "a.ts"], repo)).toEqual({ "*.ts": 0, "a.ts": 3 });
  });
  it("falls back to the unfiltered log past the pathspec limit", () => {
    const filler = Array.from({ length: Math.ceil(MAX_PATHSPEC_CHARS / 20) + 1 }, (_, i) => `dir/file-number-${i}.ts`);
    const counts = fileChurn(["a.ts", "b.ts", ...filler], repo);
    expect(counts["a.ts"]).toBe(3);
    expect(counts["b.ts"]).toBe(1);
  });
  it("handles an empty path list", () => {
    expect(fileChurn([], repo)).toEqual({});
  });
});
