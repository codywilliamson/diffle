import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { DraftsResponse, DraftUpdate } from "../src/types";
import {
  DRAFT_LIMIT_REACHED,
  DRAFT_TOO_LONG,
  MAX_DRAFTS_PER_REVIEW,
  MAX_DRAFT_KEY,
  MAX_DRAFT_SCOPES,
  MAX_DRAFT_TEXT,
  readDrafts,
  writeDrafts,
} from "../src/core/draftStore";
import { MAX_DRAFT_BODY_BYTES } from "../src/server/draftHandlers";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "nittle-drafts-"));
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

const one = (key: string, text: string): DraftUpdate[] => [{ key, text }];
const scopeFiles = () => readdirSync(join(home, ".nittle", "drafts")).filter((name) => name.endsWith(".json"));

describe("draftStore", () => {
  it("reads nothing when no file exists", () => {
    expect(readDrafts("r1", home)).toEqual({});
  });

  it("round-trips drafts per review without crossing scopes", () => {
    writeDrafts("r1", [...one("add|a.ts|new|3-3", "hello"), ...one("reply|c1", "thanks")], home);
    writeDrafts("r2", one("add|a.ts|new|3-3", "other"), home);
    expect(readDrafts("r1", home)).toEqual({ "add|a.ts|new|3-3": "hello", "reply|c1": "thanks" });
    expect(readDrafts("r2", home)).toEqual({ "add|a.ts|new|3-3": "other" });
    expect(scopeFiles()).toHaveLength(2);
  });

  it("removes a draft on empty text and deletes the file for an empty scope", () => {
    writeDrafts("r1", one("k", "x"), home);
    expect(writeDrafts("r1", one("k", ""), home).drafts).toEqual({});
    expect(scopeFiles()).toHaveLength(0);
  });

  it("a corrupt or truncated scope file loses only that scope", () => {
    writeDrafts("r1", one("k", "mine"), home);
    writeDrafts("r2", one("k", "theirs"), home);
    const dir = join(home, ".nittle", "drafts");
    const target = readdirSync(dir).find((name) => readFileSync(join(dir, name), "utf8").includes('"r1"'))!;
    writeFileSync(join(dir, target), '{"scope":"r1","drafts":{"k":"mi');
    expect(readDrafts("r1", home)).toEqual({});
    expect(readDrafts("r2", home)).toEqual({ k: "theirs" });
    expect(writeDrafts("r1", one("k2", "again"), home).drafts).toEqual({ k2: "again" });
    expect(readDrafts("r2", home)).toEqual({ k: "theirs" });
  });

  it("leaves no temp files behind", () => {
    writeDrafts("r1", one("k", "x"), home);
    expect(readdirSync(join(home, ".nittle", "drafts")).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("applies updates independently: one refused draft does not block the rest", () => {
    const result = writeDrafts("r1", [...one("big", "x".repeat(MAX_DRAFT_TEXT + 1)), ...one("", "x"), ...one("k".repeat(MAX_DRAFT_KEY + 1), "x"), ...one("ok", "fine")], home);
    expect(result.drafts).toEqual({ ok: "fine" });
    expect(result.rejected.map((r) => r.key)).toEqual(["big", "", "k".repeat(MAX_DRAFT_KEY + 1)]);
    expect(result.rejected[0]!.reason).toBe(DRAFT_TOO_LONG);
  });

  it("caps drafts per review but still allows updating or removing one", () => {
    writeDrafts("r1", Array.from({ length: MAX_DRAFTS_PER_REVIEW }, (_, i) => ({ key: `k${i}`, text: "x" })), home);
    expect(writeDrafts("r1", one("extra", "x"), home).rejected[0]!.reason).toBe(DRAFT_LIMIT_REACHED);
    expect(writeDrafts("r1", one("k0", "changed"), home).rejected).toEqual([]);
    expect(readDrafts("r1", home).k0).toBe("changed");
    writeDrafts("r1", one("k1", ""), home);
    expect(writeDrafts("r1", one("extra", "x"), home).rejected).toEqual([]);
  });

  it("keeps __proto__ and constructor as plain keys", () => {
    writeDrafts("r1", [...one("__proto__", "a"), ...one("constructor", "b")], home);
    const drafts = readDrafts("r1", home);
    expect(Object.keys(drafts).sort()).toEqual(["__proto__", "constructor"]);
    expect(Object.getOwnPropertyDescriptor(drafts, "__proto__")?.value).toBe("a");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("keeps only the most recently written reviews", async () => {
    for (let i = 0; i < MAX_DRAFT_SCOPES + 3; i++) {
      writeDrafts(`r${i}`, one("k", "x"), home);
      await Bun.sleep(5);
    }
    expect(scopeFiles()).toHaveLength(MAX_DRAFT_SCOPES);
    expect(readDrafts("r0", home)).toEqual({});
    expect(readDrafts(`r${MAX_DRAFT_SCOPES + 2}`, home)).toEqual({ k: "x" });
  });
});

describe("/api/drafts", () => {
  let server: Server<undefined>;
  let dir: string;
  const base = () => `http://127.0.0.1:${server.port}/api/drafts`;
  const post = (body: unknown) => fetch(base(), { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const list = async () => ((await (await fetch(base())).json()) as DraftsResponse).drafts;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nittle-drafts-srv-"));
    server = createServer({ diff: { ref: "working tree", files: [] }, cwd: dir, assets: directoryAssets(dir), productRoot: dir, newRef: null, diffArgs: [], includeUntracked: false, served: false, host: "cli", reviewId: `rev-drafts-${Math.random()}` });
  });
  afterEach(() => {
    server.stop(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves, lists and clears drafts in one batch", async () => {
    expect(await list()).toEqual({});
    const res = await post({ updates: [{ key: "edit|c1", text: "half a thought" }, { key: "reply|c2", text: "ok" }] });
    expect(res.status).toBe(200);
    expect(await list()).toEqual({ "edit|c1": "half a thought", "reply|c2": "ok" });
    await post({ updates: [{ key: "edit|c1", text: "" }, { key: "reply|c2", text: "" }] });
    expect(await list()).toEqual({});
  });

  it("reports refused drafts while saving the others", async () => {
    const res = (await (await post({ updates: [{ key: "big", text: "x".repeat(MAX_DRAFT_TEXT + 1) }, { key: "ok", text: "y" }] })).json()) as DraftsResponse;
    expect(res.rejected?.map((r) => r.key)).toEqual(["big"]);
    expect(await list()).toEqual({ ok: "y" });
  });

  it("answers 400 for malformed bodies, including a JSON null", async () => {
    expect((await post({ updates: [{ key: 1, text: "x" }] })).status).toBe(400);
    expect((await post({ key: "k", text: "x" })).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
    expect((await post("null")).status).toBe(400);
    expect((await post("[]")).status).toBe(400);
  });

  it("refuses an oversize body before parsing it", async () => {
    const res = await post(`{"updates":[{"key":"k","text":"${"x".repeat(MAX_DRAFT_BODY_BYTES)}"}]}`);
    expect(res.status).toBe(413);
  });
});
