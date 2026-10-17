import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { SearchResponse } from "../src/types";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";
import { parseDiff } from "../src/core/diffParser";
import { collectDiff } from "../src/utils/git";

let repo: string;
let clientDir: string;
let server: Server<undefined>;
let base: string;

function git(...args: string[]) {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.autocrlf=false", ...args], { cwd: repo });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
}

const write = (name: string, content: string | Buffer) => writeFileSync(join(repo, name), content);

async function search(params: Record<string, string>, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}/api/search?${new URLSearchParams(params)}`, { headers });
  return { status: res.status, body: (await res.json()) as SearchResponse & { error?: string } };
}

const hits = async (params: Record<string, string>) => (await search(params)).body.results;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "nittle-search-"));
  clientDir = mkdtempSync(join(tmpdir(), "nittle-search-client-"));
  git("init", "-q");
  write("keep.txt", "alpha needle\nsecond line\nNeedle Upper\n");
  write("old-name.txt", "legacy needle here\nuntouched\n");
  write("gone.txt", "removed needle\n");
  write("bin.dat", Buffer.from([0, 1, 2, 110, 101, 101, 100, 108, 101]));
  write("crlf.txt", "first\r\nneedle two\r\nthird\r\n");
  write("uni.txt", "plain\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");

  write("keep.txt", "alpha needle\nsecond line\nNeedle Upper\nnew needle line\n");
  git("mv", "old-name.txt", "new-name.txt");
  write("new-name.txt", "renamed needle here\nuntouched\n");
  git("rm", "-q", "gone.txt");
  write("bin.dat", Buffer.from([0, 9, 9, 110, 101, 101, 100, 108, 101]));
  write("crlf.txt", "first\r\nneedle two\r\nthird\r\nneedle four\r\n");
  write("uni.txt", "plain\nnaïve \u{1F600}\u{1F600} needle \u{1F600}\n");
  write("added.txt", "brand new needle\n");
  mkdirSync(join(repo, "sub"));
  write("sub/deep.txt", "deep needle\n");
  git("add", "-N", "sub/deep.txt");

  const diff = parseDiff(collectDiff(["diff", "HEAD"], repo, true, false), "working tree");
  server = createServer({ diff, cwd: repo, assets: directoryAssets(clientDir), productRoot: repo, newRef: null, diffArgs: ["diff", "HEAD"], includeUntracked: true, served: false, host: "cli" });
  base = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
  rmSync(repo, { recursive: true, force: true });
  rmSync(clientDir, { recursive: true, force: true });
});

describe("GET /api/search", () => {
  it("searches both sides, skipping binary files", async () => {
    const found = await hits({ q: "needle" });
    expect(found.some((h) => h.path === "bin.dat")).toBe(false);
    expect(found.filter((h) => h.path === "keep.txt" && h.side === "old").map((h) => h.line)).toEqual([1, 3]);
    expect(found.filter((h) => h.path === "keep.txt" && h.side === "new").map((h) => h.line)).toEqual([1, 3, 4]);
  });

  it("searches only the old side of a deleted file and the new side of an added file", async () => {
    const found = await hits({ q: "needle" });
    expect(found.filter((h) => h.path === "gone.txt").map((h) => h.side)).toEqual(["old"]);
    expect(found.filter((h) => h.path === "added.txt").map((h) => h.side)).toEqual(["new"]);
  });

  it("reads a rename's old side under the old path and its new side under the new path", async () => {
    const found = await hits({ q: "needle" });
    const old = found.find((h) => h.side === "old" && h.path === "old-name.txt");
    const now = found.find((h) => h.side === "new" && h.path === "new-name.txt");
    expect(old?.preview).toBe("legacy needle here");
    expect(now?.preview).toBe("renamed needle here");
    expect(found.some((h) => h.side === "old" && h.path === "new-name.txt")).toBe(false);
    expect(found.some((h) => h.side === "new" && h.path === "old-name.txt")).toBe(false);
  });

  it("keeps \\r out of CRLF previews and numbers lines correctly", async () => {
    const found = (await hits({ q: "needle" })).filter((h) => h.path === "crlf.txt" && h.side === "new");
    expect(found.map((h) => [h.line, h.preview])).toEqual([[2, "needle two"], [4, "needle four"]]);
    expect(found[0]!.ranges).toEqual([[0, 6]]);
  });

  it("reports ranges in utf-16 code units, so an emoji counts as two", async () => {
    const [hit] = (await hits({ q: "needle" })).filter((h) => h.path === "uni.txt");
    expect(hit!.line).toBe(2);
    expect(hit!.preview).toBe("naïve \u{1F600}\u{1F600} needle \u{1F600}");
    const [start, end] = hit!.ranges[0]!;
    expect(hit!.preview.slice(start, end)).toBe("needle");
    expect(start).toBe(11);
  });

  it("finds untracked-intent files added with intent-to-add", async () => {
    expect((await hits({ q: "deep" })).map((h) => h.path)).toEqual(["sub/deep.txt"]);
  });

  it("literal mode treats regex characters as text, regex mode does not", async () => {
    expect(await hits({ q: "n.edle" })).toEqual([]);
    expect((await hits({ q: "n.edle", regex: "1" })).length).toBeGreaterThan(0);
    expect(await hits({ q: "(needle", regex: "0" })).toEqual([]);
  });

  it("smart case is insensitive until the query has an uppercase letter", async () => {
    const lower = (await hits({ q: "needle upper" })).filter((h) => h.path === "keep.txt");
    expect(lower.length).toBe(2);
    const upper = (await hits({ q: "Needle" })).filter((h) => h.path === "keep.txt");
    expect(upper.map((h) => h.preview)).toEqual(["Needle Upper", "Needle Upper"]);
    expect((await hits({ q: "needle upper", case: "sensitive" })).length).toBe(0);
    expect((await hits({ q: "NEEDLE UPPER", case: "insensitive" })).length).toBeGreaterThan(0);
  });

  it("does not count regex escapes like \\S as uppercase for smart case", async () => {
    const found = await hits({ q: "NEEDLE\\s", regex: "1", case: "insensitive" });
    expect(found.length).toBeGreaterThan(0);
    const smart = (await hits({ q: "\\bneedle\\S*", regex: "1" })).filter((h) => h.path === "keep.txt");
    expect(smart.some((h) => h.preview === "Needle Upper")).toBe(true);
  });

  it("rejects an empty or whitespace-only query", async () => {
    expect((await search({ q: "" })).status).toBe(400);
    expect((await search({ q: "   " })).status).toBe(400);
    expect((await search({})).status).toBe(400);
  });

  it("returns 400 with a readable message for an invalid regex", async () => {
    const { status, body } = await search({ q: "(unclosed", regex: "1" });
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid regex/);
  });

  it("rejects a nested-quantifier pattern up front", async () => {
    const { status, body } = await search({ q: "(a+)+$", regex: "1" });
    expect(status).toBe(400);
    expect(body.error).toMatch(/repeated group/);
  });

  it("rejects an unknown case mode", async () => {
    expect((await search({ q: "x", case: "loud" })).status).toBe(400);
  });

  it("rejects a foreign Origin and allows the page's own", async () => {
    expect((await search({ q: "needle" }, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await search({ q: "needle" }, { Origin: base })).status).toBe(200);
  });

  it("returns an empty, untruncated result when nothing matches", async () => {
    expect((await search({ q: "zzz-no-match" })).body).toEqual({ results: [], truncated: false });
  });
});
