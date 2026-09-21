import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
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

  it("creates ~/.diffle for a fresh home and round-trips the seen version", () => {
    writeUserState({ seenVersion: "0.9.0" }, home);
    expect(existsSync(join(home, ".diffle", "state.json"))).toBe(true);
    expect(existsSync(join(home, ".loupe"))).toBe(false);
    expect(readUserState(home).seenVersion).toBe("0.9.0");
  });

  it("keeps using a legacy ~/.loupe when it exists and ~/.diffle does not", () => {
    mkdirSync(join(home, ".loupe"), { recursive: true });
    writeUserState({ seenVersion: "1.2.3" }, home);
    expect(existsSync(join(home, ".loupe", "state.json"))).toBe(true);
    expect(existsSync(join(home, ".diffle"))).toBe(false);
    expect(readUserState(home).seenVersion).toBe("1.2.3");
  });

  it("merges patches instead of clobbering the whole file", () => {
    writeUserState({ seenVersion: "0.9.0" }, home);
    const merged = writeUserState({ seenVersion: "1.0.0" }, home);
    expect(merged.seenVersion).toBe("1.0.0");
    expect(readUserState(home).seenVersion).toBe("1.0.0");
  });

  it("recovers from an unparseable file as empty state", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(join(home, ".loupe"), { recursive: true });
    writeFileSync(join(home, ".loupe", "state.json"), "{ not json");
    expect(readUserState(home)).toEqual({});
  });
});
