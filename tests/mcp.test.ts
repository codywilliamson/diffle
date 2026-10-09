import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReviewRecord } from "../src/types";
import { createMcpServer } from "../src/mcp/server";
import type { ReviewOperations } from "../src/mcp/operations";

const approvedRoot = mkdtempSync(join(tmpdir(), "loupe-mcp-root-"));
const outsideRoot = mkdtempSync(join(tmpdir(), "loupe-mcp-outside-"));
afterAll(() => { rmSync(approvedRoot, { recursive: true, force: true }); rmSync(outsideRoot, { recursive: true, force: true }); });

function record(): ReviewRecord {
  return { schemaVersion: 1, id: "r1", target: { cwd: approvedRoot, ref: "main" }, policy: "required", status: "awaiting_human", createdAt: "now", updatedAt: "now", viewed: [], comments: [], activity: [] };
}

function setup() {
  const calls: string[] = [];
  const ops: ReviewOperations = {
    startReview: async () => { calls.push("start"); return { review: record(), url: "http://localhost:1", staleSessions: 0 }; },
    getReview: async () => { calls.push("get"); return { review: record() }; },
    getScorecard: async () => { calls.push("scorecard"); return { totals: { files: 0, additions: 0, deletions: 0, effectiveLines: 0, noiseLines: 0 }, categories: [], groups: [], files: [], moved: [] }; },
    replyToComment: async () => { calls.push("reply"); return { review: record() }; },
    markCommentAddressed: async () => { calls.push("address"); return { review: record() }; },
    requestRereview: async () => { calls.push("rereview"); return { review: record() }; },
    cancelReview: async () => { calls.push("cancel"); return { review: record() }; },
    stopAll: () => { calls.push("stopAll"); },
  };
  const server = createMcpServer(ops, { getRoots: async () => [approvedRoot] });
  const client = new Client({ name: "test", version: "1" });
  return { calls, server, client };
}

describe("Loupe MCP server", () => {
  test("registers only the seven agent actions", async () => {
    const { server, client } = setup();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual(["start_review", "get_review", "get_scorecard", "reply_to_comment", "mark_comment_addressed", "request_rereview", "cancel_review"]);
    await server.close();
  });

  test("returns structured content and text fallback", async () => {
    const { server, client, calls } = setup();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({ name: "start_review", arguments: { cwd: approvedRoot, ref: "main" } });
    if (response.isError) throw new Error(JSON.stringify(response));
    expect(calls).toEqual(["start"]);
    expect(response.structuredContent).toEqual({ review: record(), url: "http://localhost:1", staleSessions: 0 });
    expect(response).toHaveProperty("content");
    await server.close();
  });

  test("rejects a cwd outside approved roots", async () => {
    const { server, client, calls } = setup();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({ name: "start_review", arguments: { cwd: outsideRoot, ref: "main" } });
    expect(response.isError).toBe(true);
    expect(calls).toEqual([]);
    await server.close();
  });
});
