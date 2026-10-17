import { describe, expect, it } from "bun:test";
import { LEGACY_MIGRATION_STEPS, runLegacyMigrations, type MigrationStep } from "../src/core/migration";

describe("runLegacyMigrations", () => {
  it("runs the data dir move before the env notice that persists into it", () => {
    const names = LEGACY_MIGRATION_STEPS.map((step) => step.name);
    expect(names.indexOf("data-dir")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("data-dir")).toBeLessThan(names.indexOf("legacy-env-notice"));
  });

  it("resolves to an empty report for no steps", async () => {
    expect(await runLegacyMigrations([])).toEqual([]);
  });

  it("runs steps in order and reports each summary", async () => {
    const order: string[] = [];
    const steps: MigrationStep[] = [
      { name: "a", run: () => { order.push("a"); return "moved 2 files"; } },
      { name: "b", run: async () => { order.push("b"); } },
    ];
    expect(await runLegacyMigrations(steps)).toEqual([
      { name: "a", ok: true, summary: "moved 2 files" },
      { name: "b", ok: true, summary: "" },
    ]);
    expect(order).toEqual(["a", "b"]);
  });

  it("keeps going after a step throws or rejects, and never throws itself", async () => {
    const steps: MigrationStep[] = [
      { name: "sync-boom", run: () => { throw new Error("disk full"); } },
      { name: "async-boom", run: async () => { throw "nope"; } },
      { name: "after", run: () => "ok" },
    ];
    expect(await runLegacyMigrations(steps)).toEqual([
      { name: "sync-boom", ok: false, summary: "disk full" },
      { name: "async-boom", ok: false, summary: "nope" },
      { name: "after", ok: true, summary: "ok" },
    ]);
  });
});
