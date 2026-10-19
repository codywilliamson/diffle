import { describe, expect, test, setDefaultTimeout } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const root = join(import.meta.dir, "..");

// the test cold-starts the cli and an mcp child
setDefaultTimeout(45_000);

describe("MCP stdio entry", () => {
  test("serves the Nittle tools through the CLI command", async () => {
    const repo = mkdtempSync(join(tmpdir(), "nittle-mcp-repo-"));
    const data = mkdtempSync(join(tmpdir(), "nittle-mcp-data-"));
    const git = (args: string[]) => Bun.spawnSync(["git", ...args], { cwd: repo });
    git(["init", "-q", "-b", "main"]); git(["config", "user.name", "t"]); git(["config", "user.email", "t@e.com"]);
    writeFileSync(join(repo, "a.ts"), "one\n"); git(["add", "-A"]); git(["commit", "-q", "-m", "init"]); writeFileSync(join(repo, "a.ts"), "two\n");
    const transport = new StdioClientTransport({
      command: "bun", args: ["src/index.ts", "mcp", "serve"], cwd: root,
      env: { ...process.env, NITTLE_ROOT: repo, NITTLE_DATA_DIR: data, NITTLE_NO_OPEN: "1" } as Record<string, string>,
    });
    const client = new Client({ name: "nittle-test", version: "1" });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("start_review");
      expect(tools.tools).toHaveLength(7);
      const started = await client.callTool({ name: "start_review", arguments: { cwd: repo, ref: "HEAD" } });
      expect(started.isError).not.toBe(true);
      const content = started.structuredContent as { url: string; review: { id: string } };
      expect(content.url).toContain("review=");
      const baseUrl = content.url.split("/?")[0]!;
      const diff = await fetch(`${baseUrl}/api/diff`).then((response) => response.json()) as { files: { path: string }[] };
      expect(diff.files.map((file) => file.path)).toContain("a.ts");

      await fetch(`${baseUrl}/api/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: [{ id: "c1", file: "a.ts", line: 1, lineContent: "+two", text: "fix it", createdAt: new Date().toISOString() }] }),
      });
      await fetch(`${baseUrl}/api/review/outcome`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: content.review.id, outcome: "feedback", summary: "reviewer note" }),
      });
      await client.callTool({ name: "request_rereview", arguments: { reviewId: content.review.id, summary: "agent update" } });
      const rereview = await client.callTool({ name: "get_review", arguments: { reviewId: content.review.id } });
      const record = (rereview.structuredContent as { review: { summary?: string; activity: { type: string; summary?: string }[] } }).review;
      expect(record.summary).toBe("reviewer note");
      expect(record.activity.findLast((item) => item.type === "rereview_requested")?.summary).toBe("agent update");

      const empty = await client.callTool({ name: "start_review", arguments: { cwd: repo, ref: "main" } });
      expect(empty.isError).toBe(true);
      expect(empty.content).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('No changes found for "main → main"') })]));
    } finally { await client.close(); rmSync(repo, { recursive: true, force: true }); rmSync(data, { recursive: true, force: true }); }
  });
});
