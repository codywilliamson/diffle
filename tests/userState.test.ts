import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readUserState, writeUserState } from "../src/core/userState";

describe("userState", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "loupe-state-"));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("returns empty state when nothing is stored", () => {
    expect(readUserState(home)).toEqual({});
  });

  it("creates state.json and round-trips user preferences", () => {
    writeUserState({ seenVersion: "0.9.0" }, home);
    expect(readUserState(home).seenVersion).toBe("0.9.0");
    writeUserState({ radarMode: "local" }, home);
    expect(readUserState(home)).toEqual({ seenVersion: "0.9.0", radarMode: "local" });
  });

  it("merges patches instead of clobbering the whole file", () => {
    writeUserState({ seenVersion: "0.9.0" }, home);
    const merged = writeUserState({ seenVersion: "1.0.0" }, home);
    expect(merged.seenVersion).toBe("1.0.0");
    expect(readUserState(home).seenVersion).toBe("1.0.0");
  });

  it("recovers from an unparseable file as empty state", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "state.json"), "{ not json");
    expect(readUserState(home)).toEqual({});
  });
});
