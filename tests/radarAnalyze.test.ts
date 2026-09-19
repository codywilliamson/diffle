import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DiffResult } from "../src/types";
import { analyzeRadar } from "../src/radar/analyze";

const dirs: string[] = [];
afterEach(() => { delete process.env.LOUPE_DATA_DIR; while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

const diff: DiffResult = { ref: "test", files: [{ path: "src/a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 1,
  hunks: [{ header: "@@ -1 +1 @@", section: "function answer()", lines: [
    { type: "deletion", oldLine: 1, newLine: null, content: "return false" },
    { type: "addition", oldLine: null, newLine: 1, content: "return true" },
  ] }] }] };

describe("Radar analysis", () => {
  test("returns deterministic analysis without a provider", async () => {
    const analysis = await analyzeRadar(diff, false, { LOUPE_RADAR: "1", LOUPE_RADAR_PROVIDER: "local" });
    expect(analysis.status).toBe("ready");
    expect(analysis.meta?.provider).toBe("local");
    expect(analysis.units).toHaveLength(1);
    expect(analysis.units[0]!.distributions).toBeNull();
  });

  test("enriches then reuses a provider result without persisting packets", async () => {
    const data = mkdtempSync(join(tmpdir(), "loupe-radar-")); dirs.push(data); process.env.LOUPE_DATA_DIR = data;
    let calls = 0;
    const fetchFn = (async () => { calls++; return Response.json({ model: "jev-1.13", answers: {
      attention: { type: "noul", noul: 0.8 }, impact: { type: "score", score: 2, probabilities: { "2": 0.75, "3": 0.1 } },
      kind: { type: "choice", choice: "control_flow", probabilities: { control_flow: 1 } }, evidence_sufficient: { type: "noul", noul: 0.7 },
    } }); }) as unknown as typeof fetch;
    const env = { LOUPE_RADAR_PROVIDER: "openrouter", OPENROUTER_API_KEY: "secret" };
    const first = await analyzeRadar(diff, false, env, fetchFn);
    const second = await analyzeRadar(diff, false, env, fetchFn);
    expect(first.units[0]!.lane).toBe("attention");
    expect(first.units[0]!.attention).toBe(80);
    expect(second.status).toBe("cached");
    expect(calls).toBe(1);
    expect(JSON.stringify(second)).not.toContain("return true");
  });

  test("keeps successful units when another provider call fails", async () => {
    const data = mkdtempSync(join(tmpdir(), "loupe-radar-partial-")); dirs.push(data); process.env.LOUPE_DATA_DIR = data;
    const two = { ...diff, files: [...diff.files, { ...diff.files[0]!, path: "src/b.ts" }] };
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      if (calls > 1) return Response.json({ error: { message: "bad unit" } }, { status: 400 });
      return Response.json({ model: "jev", answers: {
        attention: { type: "noul", noul: 0.8 }, impact: { type: "score", score: 2, probabilities: { "2": 1 } },
        kind: { type: "choice", choice: "control_flow", probabilities: { control_flow: 1 } }, evidence_sufficient: { type: "noul", noul: 0.8 },
      } });
    }) as unknown as typeof fetch;
    const env = { LOUPE_RADAR_PROVIDER: "openrouter", OPENROUTER_API_KEY: "secret" };
    const first = await analyzeRadar(two, true, env, fetchFn);
    const second = await analyzeRadar(two, false, env, fetchFn);
    expect(first.status).toBe("partial");
    expect(first.units.map((unit) => unit.providerStatus).sort()).toEqual(["failed", "ready"]);
    expect(second.status).toBe("partial");
    expect(calls).toBe(2);
  });
});
