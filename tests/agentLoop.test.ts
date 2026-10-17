// the agent loop, end to end over real stdio: the mcp server is spawned as an agent would launch
// it (`mcp serve`) and driven start_review -> get_review -> reply_to_comment ->
// mark_comment_addressed -> request_rereview. run alone with `bun run test:agent-loop`.

import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "../src/core/product";
import type { ReviewRecord } from "../src/types";

const root = join(import.meta.dir, "..");
const COMMENT_ID = "c1";
const REVIEWER_NOTE = "please rename this";
const AGENT_REPLY = "renamed it";

interface Result { review: ReviewRecord; url?: string; }

function tempGitRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "nittle-loop-repo-"));
  const git = (args: string[]) => Bun.spawnSync(["git", ...args], { cwd: repo });
  git(["init", "-q", "-b", "main"]); git(["config", "user.name", "t"]); git(["config", "user.email", "t@e.com"]);
  writeFileSync(join(repo, "a.ts"), "one\n"); git(["add", "-A"]); git(["commit", "-q", "-m", "init"]);
  writeFileSync(join(repo, "a.ts"), "two\n");
  return repo;
}

describe("agent loop over mcp stdio", () => {
  test("start, review, reply, address, rereview under the nittle server name", async () => {
    const repo = tempGitRepo();
    const data = mkdtempSync(join(tmpdir(), "nittle-loop-data-"));
    const client = new Client({ name: "agent-loop-test", version: "1" });
    const call = async (name: string, args: Record<string, unknown>): Promise<Result> => {
      const response = await client.callTool({ name, arguments: args });
      expect(response.isError, `${name} failed: ${JSON.stringify(response.content)}`).not.toBe(true);
      return response.structuredContent as unknown as Result;
    };
    try {
      await client.connect(new StdioClientTransport({
        command: "bun", args: ["src/index.ts", "mcp", "serve"], cwd: root,
        env: { ...process.env, NITTLE_ROOT: repo, NITTLE_DATA_DIR: data, NITTLE_NO_OPEN: "1", NITTLE_NO_UPDATE_CHECK: "1" } as Record<string, string>,
      }));
      expect(client.getServerVersion()?.name).toBe(PRODUCT.name);
      const tools = (await client.listTools()).tools.map((tool) => tool.name);
      for (const tool of ["start_review", "get_review", "reply_to_comment", "mark_comment_addressed", "request_rereview"]) expect(tools).toContain(tool);

      const started = await call("start_review", { cwd: repo, ref: "HEAD" });
      const reviewId = started.review.id;
      expect(started.url).toContain(`review=${reviewId}`);
      const baseUrl = started.url!.split("/?")[0]!;

      const posted = await fetch(`${baseUrl}/api/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: [{ id: COMMENT_ID, file: "a.ts", line: 1, lineContent: "+two", text: REVIEWER_NOTE, createdAt: new Date().toISOString() }] }),
      });
      expect(posted.ok).toBe(true);
      const outcome = await fetch(`${baseUrl}/api/review/outcome`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewId, outcome: "feedback", summary: "needs changes" }),
      });
      expect(outcome.ok).toBe(true);

      const fetched = await call("get_review", { reviewId });
      const comment = fetched.review.comments.find((item) => item.id === COMMENT_ID);
      expect(comment?.text).toBe(REVIEWER_NOTE);
      expect(fetched.review.summary).toBe("needs changes");

      const replied = await call("reply_to_comment", { reviewId, commentId: COMMENT_ID, text: AGENT_REPLY });
      const reply = replied.review.comments.find((item) => item.id === COMMENT_ID)?.replies?.at(-1);
      expect(reply).toMatchObject({ author: "agent", text: AGENT_REPLY });

      const addressed = await call("mark_comment_addressed", { reviewId, commentId: COMMENT_ID });
      expect(addressed.review.comments.find((item) => item.id === COMMENT_ID)?.status).toBe("addressed");

      const rereview = await call("request_rereview", { reviewId, summary: "renamed" });
      expect(rereview.review.activity.findLast((item) => item.type === "rereview_requested")?.summary).toBe("renamed");
      const types = rereview.review.activity.map((item) => item.type);
      expect(types.indexOf("comment_replied")).toBeLessThan(types.indexOf("comment_addressed"));
      expect(types.indexOf("comment_addressed")).toBeLessThan(types.indexOf("rereview_requested"));
    } finally {
      await client.close();
      rmSync(repo, { recursive: true, force: true });
      rmSync(data, { recursive: true, force: true });
    }
  }, 45_000);
});
