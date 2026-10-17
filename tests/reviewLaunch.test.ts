import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Comment, ReviewRecord } from "../src/types";
import { launchReview } from "../src/core/reviewLaunch";
import { readReviewRecord } from "../src/core/reviewRecords";
import { listSessions, stopSession } from "../src/core/sessions";

const git = (args: string[], cwd: string) => Bun.spawnSync(["git", ...args], { cwd });
const root = join(import.meta.dir, "..");
let repo: string;
let data: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "nittle-launch-repo-")); data = mkdtempSync(join(tmpdir(), "nittle-launch-data-"));
  process.env.NITTLE_DATA_DIR = data; git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.name", "t"], repo); git(["config", "user.email", "t@e.com"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 1;\n"); git(["add", "-A"], repo); git(["commit", "-q", "-m", "init"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 2;\n");
});
afterAll(() => { delete process.env.NITTLE_DATA_DIR; rmSync(repo, { recursive: true, force: true }); rmSync(data, { recursive: true, force: true }); });

describe("review launch", () => {
  it("rejects an empty required comparison before opening a review", () => {
    expect(() => launchReview({ cwd: repo, productRoot: root, spec: "main", open: false, requireChanges: true, host: "mcp" }))
      .toThrow('No changes found for "main → main"');
  });

  it("launches a durable browser review without writing legacy .review", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      expect(launch.url).toContain(`review=${launch.review.id}`);
      const review = await fetch(`${launch.url.split("/?")[0]}/api/review`).then((res) => res.json()) as ReviewRecord;
      expect(review.id).toBe(launch.review.id);
      const comment: Comment = { id: "c1", file: "a.ts", line: 1, lineContent: "+const a = 2;", text: "why?", createdAt: new Date().toISOString() };
      const saved = await fetch(`${launch.url.split("/?")[0]}/api/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comments: [comment] }) });
      expect(saved.status).toBe(200); expect(readReviewRecord(review.id)?.comments).toHaveLength(1);
      expect(existsSync(join(repo, ".review"))).toBe(false);
      const compiled = await fetch(`${launch.url.split("/?")[0]}/api/compile`).then((res) => res.json()) as { prompt: string };
      expect(compiled.prompt).toContain("why?");
    } finally { launch.server.stop(true); }
  });

  it("POST /api/review/reply stores the reply authored by the reviewer", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      const base = launch.url.split("/?")[0];
      const comment: Comment = { id: "c1", file: "a.ts", line: 1, lineContent: "+const a = 2;", text: "why?", createdAt: new Date().toISOString() };
      await fetch(`${base}/api/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comments: [comment] }) });

      const res = await fetch(`${base}/api/review/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: launch.review.id, commentId: "c1", text: "because reasons" }),
      });
      expect(res.status).toBe(200);
      const record = readReviewRecord(launch.review.id);
      const reply = record?.comments[0]?.replies?.[0];
      expect(reply?.author).toBe("reviewer");
      expect(reply?.text).toBe("because reasons");
      expect(record?.activity.findLast((item) => item.type === "comment_replied")?.actor).toBe("reviewer");
    } finally { launch.server.stop(true); }
  });

  it("returns summary-only feedback with no comments and compiles it, with a query override", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      const base = launch.url.split("/?")[0];
      const res = await fetch(`${base}/api/review/outcome`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: launch.review.id, outcome: "feedback", summary: "Tighten the error path." }),
      });
      expect(res.status).toBe(200);
      const record = (await res.json()) as ReviewRecord;
      expect(record.status).toBe("feedback_ready");

      const compiled = (await fetch(`${base}/api/compile`).then((r) => r.json())) as { prompt: string };
      expect(compiled.prompt).toContain("Reviewer summary");
      expect(compiled.prompt).toContain("Tighten the error path.");

      const overridden = (await fetch(`${base}/api/compile?summary=${encodeURIComponent("Draft note")}`).then((r) => r.json())) as { prompt: string };
      expect(overridden.prompt).toContain("Draft note");
      expect(overridden.prompt).not.toContain("Tighten the error path.");
    } finally { launch.server.stop(true); }
  });

  it("registers a session on launch and stops it through the http endpoint", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      const base = launch.url.split("/?")[0];
      const entry = listSessions().find((item) => item.reviewId === launch.review.id);
      expect(entry).toBeDefined();
      const res = await fetch(`${base}/api/session/stop`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: entry!.sessionId }),
      });
      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 200)); // the actual stop+unregister is deferred a beat
      expect(listSessions().some((item) => item.reviewId === launch.review.id)).toBe(false);
      await expect(fetch(`${base}/api/diff`)).rejects.toThrow();
    } finally { launch.server.stop(true); }
  });

  it("stopSession from the sessions module stops a launch the same way", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      const base = launch.url.split("/?")[0];
      const entry = listSessions().find((item) => item.reviewId === launch.review.id)!;
      expect(await stopSession(entry)).toBe(true);
      await new Promise((r) => setTimeout(r, 200)); // the actual stop+unregister is deferred a beat
      expect(listSessions().some((item) => item.reviewId === launch.review.id)).toBe(false);
      await expect(fetch(`${base}/api/diff`)).rejects.toThrow();
    } finally { launch.server.stop(true); }
  });

  it("POST /api/session/stop rejects a mismatched Origin", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      const base = launch.url.split("/?")[0];
      const entry = listSessions().find((item) => item.reviewId === launch.review.id)!;
      const res = await fetch(`${base}/api/session/stop`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: "http://evil.example" },
        body: JSON.stringify({ sessionId: entry.sessionId }),
      });
      expect(res.status).toBe(403);
      expect(listSessions().some((item) => item.reviewId === launch.review.id)).toBe(true);
    } finally { launch.server.stop(true); }
  });

  it("POST /api/session/stop rejects a wrong sessionId", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      const base = launch.url.split("/?")[0];
      const res = await fetch(`${base}/api/session/stop`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "not-the-right-session-id" }),
      });
      expect(res.status).toBe(403);
      expect(listSessions().some((item) => item.reviewId === launch.review.id)).toBe(true);
    } finally { launch.server.stop(true); }
  });

  it("GET /api/session/stop is not found (POST-only route)", async () => {
    const launch = launchReview({ cwd: repo, productRoot: root, open: false, policy: "handoff", host: "mcp" });
    try {
      const base = launch.url.split("/?")[0];
      const res = await fetch(`${base}/api/session/stop`);
      expect(res.status).toBe(404);
    } finally { launch.server.stop(true); }
  });
});
