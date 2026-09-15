import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerContext } from "../src/server/handlers";
import { handleGetFile, handleGetRaw } from "../src/server/fileHandlers";

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const url = (path: string) => new URL(`http://loupe/api/raw?path=${encodeURIComponent(path)}`);
const git = (cwd: string, ...args: string[]) =>
  Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd });

let cwd: string;
let outside: string;
let hasSymlink = false; // windows needs developer mode or admin to create symlinks
let workingTree: ServerContext;
let committed: ServerContext;

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), "loupe-files-"));
  mkdirSync(join(cwd, "docs"));
  writeFileSync(join(cwd, "docs", "shot.png"), PNG_HEADER);
  writeFileSync(join(cwd, "README.md"), "# Hello\n");
  git(cwd, "init", "-q");
  git(cwd, "add", ".");
  git(cwd, "commit", "-q", "-m", "seed");
  outside = mkdtempSync(join(tmpdir(), "loupe-outside-"));
  writeFileSync(join(outside, "secret.png"), PNG_HEADER);
  try {
    symlinkSync(join(outside, "secret.png"), join(cwd, "docs", "escape.png"), "file");
    hasSymlink = true;
  } catch {}
  workingTree = { cwd, newRef: null } as ServerContext;
  committed = { cwd, newRef: "HEAD" } as ServerContext;
});

afterAll(() => {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("handleGetRaw", () => {
  it("serves working-tree bytes with an image content type", async () => {
    const res = handleGetRaw(workingTree, url("docs/shot.png"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_HEADER);
  });

  it("serves committed bytes via git show without mangling them", async () => {
    const res = handleGetRaw(committed, url("docs/shot.png"));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_HEADER);
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(handleGetRaw(workingTree, url("README.md")).headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("rejects traversal and absolute paths", () => {
    expect(handleGetRaw(workingTree, url("../escape.png")).status).toBe(400);
    expect(handleGetRaw(workingTree, url("C:/Windows/win.ini")).status).toBe(400);
    expect(handleGetRaw(workingTree, url("/etc/passwd")).status).toBe(400);
    expect(handleGetRaw(workingTree, new URL("http://loupe/api/raw")).status).toBe(400);
  });

  it("refuses a symlink that leaves the repo", () => {
    if (!hasSymlink) return;
    expect(handleGetRaw(workingTree, url("docs/escape.png")).status).toBe(404);
  });

  it("404s a missing file in both modes", () => {
    expect(handleGetRaw(workingTree, url("docs/nope.png")).status).toBe(404);
    expect(handleGetRaw(committed, url("docs/nope.png")).status).toBe(404);
  });
});

describe("handleGetFile", () => {
  it("returns text content from the working tree and from a ref", async () => {
    for (const ctx of [workingTree, committed]) {
      const res = handleGetFile(ctx, url("README.md"));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { content: string }).content).toBe("# Hello\n");
    }
  });
});
