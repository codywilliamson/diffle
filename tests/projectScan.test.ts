import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contextFile, scanProject } from "../src/core/projectScan";

function git(args: string[], cwd: string): void {
  Bun.spawnSync(["git", ...args], { cwd });
}

describe("contextFile", () => {
  it("numbers every line from 1 and marks them all context", () => {
    const f = contextFile("a.ts", "const x = 1\nconst y = 2\n");
    expect(f.changeType).toBe("modified");
    expect(f.additions).toBe(0);
    expect(f.deletions).toBe(0);
    expect(f.hunks).toHaveLength(1);
    expect(f.hunks[0]!.lines).toEqual([
      { type: "context", oldLine: 1, newLine: 1, content: "const x = 1" },
      { type: "context", oldLine: 2, newLine: 2, content: "const y = 2" },
    ]);
  });

  it("drops a single trailing empty line from a terminating newline", () => {
    const f = contextFile("a.ts", "one\ntwo\n");
    expect(f.hunks[0]!.lines.map((l) => l.content)).toEqual(["one", "two"]);
  });

  it("keeps internal blank lines", () => {
    const f = contextFile("a.ts", "one\n\nthree\n");
    expect(f.hunks[0]!.lines.map((l) => l.content)).toEqual(["one", "", "three"]);
  });

  it("handles a single line with no trailing newline", () => {
    const f = contextFile("a.ts", "only");
    expect(f.hunks[0]!.lines.map((l) => l.content)).toEqual(["only"]);
  });
});

describe("scanProject", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nittle-scan-"));
    git(["init", "-q", "-b", "main"], dir);
    git(["config", "user.name", "t"], dir);
    git(["config", "user.email", "t@e.com"], dir);
  });
  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // windows occasionally holds a .git pack handle; cleanup is best-effort
    }
  });

  it("returns every tracked file as an all-context diff", () => {
    writeFileSync(join(dir, "a.ts"), "export const a = 1\n");
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "b.ts"), "export const b = 2\n");
    git(["add", "-A"], dir);

    const diff = scanProject(dir);
    expect(diff.ref).toBe("codebase");
    expect(diff.meta?.mode).toBe("browse");
    expect(diff.files.map((f) => f.path).sort()).toEqual(["a.ts", "src/b.ts"]);
    expect(
      diff.files.every((f) => f.hunks.every((h) => h.lines.every((l) => l.type === "context")))
    ).toBe(true);
  });

  it("flags binary files (NUL byte) without hunks", () => {
    writeFileSync(join(dir, "data.bin"), Buffer.from([0x01, 0x00, 0x02]));
    git(["add", "-A"], dir);
    const bin = scanProject(dir).files.find((f) => f.path === "data.bin");
    expect(bin?.binary).toBe(true);
    expect(bin?.hunks).toEqual([]);
  });

  it("skips tracked files deleted from the working tree", () => {
    writeFileSync(join(dir, "kept.ts"), "1\n");
    writeFileSync(join(dir, "gone.ts"), "2\n");
    git(["add", "-A"], dir);
    git(["commit", "-qm", "init"], dir);
    rmSync(join(dir, "gone.ts"));

    // ls-files still reports gone.ts from the index; reading it would throw ENOENT
    expect(scanProject(dir).files.map((f) => f.path)).toEqual(["kept.ts"]);
  });

  it("survives every tracked file being deleted", () => {
    writeFileSync(join(dir, "gone.ts"), "1\n");
    git(["add", "-A"], dir);
    git(["commit", "-qm", "init"], dir);
    rmSync(join(dir, "gone.ts"));

    expect(scanProject(dir).files).toEqual([]);
  });

  it("scopes the scan to a path argument", () => {
    writeFileSync(join(dir, "root.ts"), "1\n");
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "in.ts"), "2\n");
    git(["add", "-A"], dir);
    expect(scanProject(dir, "src").files.map((f) => f.path)).toEqual(["src/in.ts"]);
  });
});
