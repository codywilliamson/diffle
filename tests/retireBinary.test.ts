import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRetiredLeftover, retireBinary, retiredName } from "../src/core/retireBinary";

const target = join("bin", "nittle.exe");

describe("retiredName", () => {
  test("uses the plain name when free, a timestamped one when taken", () => {
    expect(retiredName(target, false)).toBe(".nittle.exe.old");
    expect(retiredName(target, true, 42)).toBe(".nittle.exe.old-42");
  });

  test("recognises plain and timestamped leftovers only", () => {
    expect(isRetiredLeftover(".nittle.exe.old", target)).toBe(true);
    expect(isRetiredLeftover(".nittle.exe.old-42", target)).toBe(true);
    expect(isRetiredLeftover("nittle.exe", target)).toBe(false);
    expect(isRetiredLeftover(".nittle.exe.new", target)).toBe(false);
  });
});

describe("retireBinary", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("moves the binary aside and clears stale leftovers", () => {
    dir = mkdtempSync(join(tmpdir(), "retire-"));
    const exe = join(dir, "nittle.exe");
    writeFileSync(exe, "current");
    writeFileSync(join(dir, ".nittle.exe.old"), "stale");
    writeFileSync(join(dir, ".nittle.exe.old-1"), "stale");
    retireBinary(exe);
    expect(readdirSync(dir)).toEqual([".nittle.exe.old"]);
  });
});
