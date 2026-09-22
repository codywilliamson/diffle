import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { DiffResult, ReviewFile, Comment } from "../src/types";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";

const diff: DiffResult = {
  ref: "working tree",
  files: [
    {
      path: "a.ts",
      oldPath: null,
      changeType: "modified",
      additions: 1,
      deletions: 0,
      hunks: [
        {
          header: "@@ -1,1 +1,2 @@",
          lines: [
            { type: "context", oldLine: 1, newLine: 1, content: "x" },
            { type: "addition", oldLine: null, newLine: 2, content: "y" },
          ],
        },
      ],
    },
  ],
};

const sampleComment: Comment = {
  id: "c1",
  file: "a.ts",
  line: 2,
  lineContent: "+y",
  text: "looks good",
  createdAt: "2026-06-02T00:00:00.000Z",
};

let server: Server<undefined>;
let base: string;
let cwd: string;
let clientDir: string;

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), "loupe-cwd-"));
  clientDir = mkdtempSync(join(tmpdir(), "loupe-client-"));
  writeFileSync(join(clientDir, "index.html"), "<!doctype html><title>loupe</title>");
  writeFileSync(join(clientDir, "app.js"), "console.log('loupe');");
  writeFileSync(join(cwd, "readme.md"), "# Hello\n");
  server = createServer({ diff, cwd, assets: directoryAssets(clientDir), loupeRoot: cwd, newRef: null, diffArgs: ["diff", "HEAD"], includeUntracked: false, served: false, host: "cli" });
  base = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
  rmSync(cwd, { recursive: true, force: true });
  rmSync(clientDir, { recursive: true, force: true });
});

describe("router", () => {
  it("GET /api/diff returns the diff", async () => {
    const res = await fetch(`${base}/api/diff`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(diff);
  });

  it("GET /api/comments returns {} when no .review exists", async () => {
    const res = await fetch(`${base}/api/comments`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it("POST /api/comments persists and returns the review", async () => {
    const res = await fetch(`${base}/api/comments`, {
      method: "POST",
      body: JSON.stringify({ comments: [sampleComment] }),
    });
    expect(res.status).toBe(200);
    const review = (await res.json()) as ReviewFile;
    expect(review.comments).toEqual([sampleComment]);

    expect(existsSync(join(cwd, ".review"))).toBe(true);
    const onDisk = JSON.parse(readFileSync(join(cwd, ".review"), "utf8")) as ReviewFile;
    expect(onDisk.comments).toEqual([sampleComment]);
  });

  it("POST /api/comments rejects invalid json", async () => {
    const res = await fetch(`${base}/api/comments`, { method: "POST", body: "not json" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBeString();
  });

  it("POST /api/comments rejects a missing array", async () => {
    const res = await fetch(`${base}/api/comments`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBeString();
  });

  it("POST /api/viewed persists the viewed list", async () => {
    const res = await fetch(`${base}/api/viewed`, {
      method: "POST",
      body: JSON.stringify({ viewed: ["a.ts"] }),
    });
    expect(res.status).toBe(200);
    const review = (await res.json()) as ReviewFile;
    expect(review.viewed).toEqual(["a.ts"]);
    const onDisk = JSON.parse(readFileSync(join(cwd, ".review"), "utf8")) as ReviewFile;
    expect(onDisk.viewed).toEqual(["a.ts"]);
  });

  it("GET /api/compile returns a prompt string", async () => {
    const res = await fetch(`${base}/api/compile`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { prompt: string };
    expect(body.prompt).toBeString();
    expect(body.prompt).toContain("## Code Review");
  });

  it("POST /api/state rejects a body with no known field", async () => {
    const res = await fetch(`${base}/api/state`, { method: "POST", body: JSON.stringify({ nope: 1 }) });
    expect(res.status).toBe(400);
  });

  const postPaths = [
    "/api/comments", "/api/viewed", "/api/state", "/api/review/outcome",
    "/api/review/reply", "/api/review/status", "/api/review/legacy", "/api/session/stop",
  ];

  for (const path of postPaths) {
    it(`POST ${path} rejects a foreign Origin before its handler runs`, async () => {
      const res = await fetch(`${base}${path}`, {
        method: "POST", headers: { Origin: "https://example.com" }, body: "not json",
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "origin mismatch" });
    });

    it(`POST ${path} still reaches its handler with same Origin or no Origin`, async () => {
      for (const origin of [base, undefined]) {
        const res = await fetch(`${base}${path}`, {
          method: "POST", headers: origin ? { Origin: origin } : {}, body: "not json",
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid json body" });
      }
    });
  }

  it("blocks a foreign Origin without changing comments or user state", async () => {
    const commentsBefore = await fetch(`${base}/api/comments`).then((res) => res.text());
    const stateBefore = await fetch(`${base}/api/state`).then((res) => res.text());
    const headers = { Origin: "https://example.com", "Content-Type": "application/json" };
    const comments = await fetch(`${base}/api/comments`, {
      method: "POST", headers, body: JSON.stringify({ comments: [] }),
    });
    const state = await fetch(`${base}/api/state`, {
      method: "POST", headers, body: JSON.stringify({ seenVersion: "injected" }),
    });
    expect(comments.status).toBe(403);
    expect(state.status).toBe(403);
    expect(await fetch(`${base}/api/comments`).then((res) => res.text())).toBe(commentsBefore);
    expect(await fetch(`${base}/api/state`).then((res) => res.text())).toBe(stateBefore);
  });

  it("rejects a matching Origin forged through the Host header", async () => {
    const commentsBefore = await fetch(`${base}/api/comments`).then((res) => res.text());
    for (const host of [`evil.example:${server.port}`, `localhost:${server.port! + 1}`]) {
      const res = await fetch(`${base}/api/comments`, {
        method: "POST",
        headers: { Host: host, Origin: `http://${host}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comments: [] }),
      });
      expect(res.status).toBe(403);
    }
    expect(await fetch(`${base}/api/comments`).then((response) => response.text())).toBe(commentsBefore);
  });

  it("accepts the 127.0.0.1 origin when the request uses that host", async () => {
    const loopbackBase = `http://127.0.0.1:${server.port}`;
    const res = await fetch(`${loopbackBase}/api/comments`, {
      method: "POST", headers: { Origin: loopbackBase }, body: "not json",
    });
    expect(res.status).toBe(400);

    const mixedHost = await fetch(`${loopbackBase}/api/comments`, {
      method: "POST", headers: { Origin: base }, body: "not json",
    });
    expect(mixedHost.status).toBe(403);
  });

  it("keeps GET requests available with a foreign Origin", async () => {
    const res = await fetch(`${base}/api/comments`, { headers: { Origin: "https://example.com" } });
    expect(res.status).toBe(200);
  });

  it("GET /api/file returns new-side content (working tree reads disk)", async () => {
    const res = await fetch(`${base}/api/file?path=readme.md`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { content: string }).content).toContain("# Hello");
  });

  it("GET /api/file rejects a traversal path", async () => {
    const res = await fetch(`${base}/api/file?path=../escape`);
    expect(res.status).toBe(400);
  });

  it("GET / serves index.html as text/html", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("GET /app.js serves text/javascript", async () => {
    const res = await fetch(`${base}/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
  });

  it("GET a missing asset returns 404", async () => {
    const res = await fetch(`${base}/nope.js`);
    expect(res.status).toBe(404);
  });

  it("GET a traversal path returns 404", async () => {
    const res = await fetch(`${base}/../secret`, { redirect: "manual" });
    expect(res.status).toBe(404);
  });
});
