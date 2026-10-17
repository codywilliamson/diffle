import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLegacyEnvStep } from "../src/core/migration/legacyEnv";
import { legacyEnvRenames, productEnv } from "../src/utils/env";
import { readUserState } from "../src/core/userState";

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), "nittle-env-")); });
afterEach(() => { rmSync(home, { recursive: true, force: true }); delete process.env.NITTLE_ZZ; delete process.env.DIFFLE_ZZ; });

describe("env fallback", () => {
  it("NITTLE_ wins over DIFFLE_, and DIFFLE_ alone still works", () => {
    process.env.DIFFLE_ZZ = "old";
    expect(productEnv("ZZ")).toBe("old");
    process.env.NITTLE_ZZ = "new";
    expect(productEnv("ZZ")).toBe("new");
  });

  it("only lists deprecated vars that have no NITTLE_ twin", () => {
    const env = { DIFFLE_A: "1", NITTLE_A: "2", DIFFLE_B: "1", LOUPE_C: "1" };
    expect(legacyEnvRenames(env)).toEqual(["DIFFLE_B -> NITTLE_B"]);
  });
});

describe("legacy env notice", () => {
  it("prints once per var set, persists that in user state, and again if the set changes", () => {
    const seen: string[] = [];
    const run = (env: NodeJS.ProcessEnv) => createLegacyEnvStep({ env, home, warn: (m) => seen.push(m) }).run();
    run({ DIFFLE_DATA_DIR: "/x", DIFFLE_NO_OPEN: "1" });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("DIFFLE_DATA_DIR -> NITTLE_DATA_DIR");
    expect(seen[0]).toContain("DIFFLE_NO_OPEN -> NITTLE_NO_OPEN");
    expect(readUserState(home).legacyEnvNoticed).toBeTruthy();
    run({ DIFFLE_DATA_DIR: "/x", DIFFLE_NO_OPEN: "1" });
    expect(seen).toHaveLength(1);
    run({ DIFFLE_DATA_DIR: "/x" });
    expect(seen).toHaveLength(2);
  });

  it("is silent when no DIFFLE_ var is in use", () => {
    const seen: string[] = [];
    createLegacyEnvStep({ env: { NITTLE_DATA_DIR: "/x" }, home, warn: (m) => seen.push(m) }).run();
    expect(seen).toEqual([]);
  });
});
