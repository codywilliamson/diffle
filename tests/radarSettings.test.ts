import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import type { DiffResult } from "../src/types";
import { createServer } from "../src/server/router";

const diff: DiffResult = { ref: "test", files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0,
  hunks: [{ header: "@@ -0,0 +1 @@", lines: [{ type: "addition", oldLine: null, newLine: 1, content: "return true" }] }] }] };
let root: string;
let server: Server<undefined>;
let base: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "loupe-radar-settings-"));
  process.env.LOUPE_DATA_DIR = root;
  server = createServer({ diff, cwd: root, clientDir: root, loupeRoot: root, newRef: null,
    diffArgs: ["diff", "HEAD"], includeUntracked: false, served: false, host: "cli" });
  base = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
  delete process.env.LOUPE_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
});

describe("Radar settings", () => {
  test("persists privacy mode and applies it to analysis", async () => {
    const local = await fetch(`${base}/api/state`, { method: "POST", body: JSON.stringify({ radarMode: "local" }) });
    expect(local.status).toBe(200);
    expect((await local.json() as { radarMode: string }).radarMode).toBe("local");
    expect((await fetch(`${base}/api/radar`).then((res) => res.json()) as { status: string }).status).toBe("ready");
    const off = await fetch(`${base}/api/state`, { method: "POST", body: JSON.stringify({ radarMode: "off" }) });
    expect(off.status).toBe(200);
    expect((await fetch(`${base}/api/radar`).then((res) => res.json()) as { status: string }).status).toBe("off");
  });
});
