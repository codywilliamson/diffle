import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { DraftsResponse } from "../src/types";
import {
  MAX_DRAFTS_PER_REVIEW,
  MAX_DRAFT_KEY,
  MAX_DRAFT_SCOPES,
  MAX_DRAFT_TEXT,
  readDrafts,
  writeDraft,
} from "../src/core/draftStore";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "nittle-drafts-"));
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("draftStore", () => {
  it("reads nothing when no file exists", () => {
    expect(readDrafts("r1", home)).toEqual({});
  });

  it("round-trips drafts per review without crossing scopes", () => {
    writeDraft("r1", "add|a.ts|new|3-3", "hello", home);
    writeDraft("r1", "reply|c1", "thanks", home);
    writeDraft("r2", "add|a.ts|new|3-3", "other", home);
    expect(readDrafts("r1", home)).toEqual({ "add|a.ts|new|3-3": "hello", "reply|c1": "thanks" });
    expect(readDrafts("r2", home)).toEqual({ "add|a.ts|new|3-3": "other" });
    expect(existsSync(join(home, ".nittle", "drafts.json"))).toBe(true);
  });

  it("removes a draft on empty text and drops an empty scope", () => {
    writeDraft("r1", "k", "x", home);
    expect(writeDraft("r1", "k", "", home)).toEqual({});
    expect(readDrafts("r1", home)).toEqual({});
  });

  it("survives a corrupt file", () => {
    writeDraft("r1", "k", "x", home);
    Bun.write(join(home, ".nittle", "drafts.json"), "{nope");
    expect(readDrafts("r1", home)).toEqual({});
    expect(writeDraft("r1", "k2", "y", home)).toEqual({ k2: "y" });
  });

  it("refuses oversize keys, text, and too many drafts, but still allows updating one", () => {
    expect(typeof writeDraft("r1", "k".repeat(MAX_DRAFT_KEY + 1), "x", home)).toBe("string");
    expect(typeof writeDraft("r1", "", "x", home)).toBe("string");
    expect(typeof writeDraft("r1", "k", "x".repeat(MAX_DRAFT_TEXT + 1), home)).toBe("string");
    for (let i = 0; i < MAX_DRAFTS_PER_REVIEW; i++) writeDraft("r1", `k${i}`, "x", home);
    expect(typeof writeDraft("r1", "extra", "x", home)).toBe("string");
    expect(typeof writeDraft("r1", "k0", "changed", home)).toBe("object");
    expect(readDrafts("r1", home).k0).toBe("changed");
  });

  it("keeps only the most recently written reviews", () => {
    for (let i = 0; i < MAX_DRAFT_SCOPES + 3; i++) writeDraft(`r${i}`, "k", "x", home);
    expect(readDrafts("r0", home)).toEqual({});
    expect(readDrafts(`r${MAX_DRAFT_SCOPES + 2}`, home)).toEqual({ k: "x" });
  });
});

describe("/api/drafts", () => {
  let server: Server<undefined>;
  let dir: string;
  const base = () => `http://127.0.0.1:${server.port}/api/drafts`;
  const post = (body: unknown) => fetch(base(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nittle-drafts-srv-"));
    server = createServer({ diff: { ref: "working tree", files: [] }, cwd: dir, assets: directoryAssets(dir), productRoot: dir, newRef: null, diffArgs: [], includeUntracked: false, served: false, host: "cli", reviewId: "rev-drafts" });
  });
  afterEach(() => {
    server.stop(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves, lists and clears a draft", async () => {
    expect(((await (await fetch(base())).json()) as DraftsResponse).drafts).toEqual({});
    expect((await post({ key: "edit|c1", text: "half a thought" })).status).toBe(200);
    expect(((await (await fetch(base())).json()) as DraftsResponse).drafts).toEqual({ "edit|c1": "half a thought" });
    await post({ key: "edit|c1", text: "" });
    expect(((await (await fetch(base())).json()) as DraftsResponse).drafts).toEqual({});
  });

  it("rejects a malformed body and an oversize draft", async () => {
    expect((await post({ key: 1, text: "x" })).status).toBe(400);
    expect((await fetch(base(), { method: "POST", body: "{nope" })).status).toBe(400);
    expect((await post({ key: "k", text: "x".repeat(MAX_DRAFT_TEXT + 1) })).status).toBe(400);
  });
});
