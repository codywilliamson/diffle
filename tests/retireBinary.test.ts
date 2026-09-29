import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRetiredLeftover, retireBinary, retiredName } from "../src/core/retireBinary";

const target = join("bin", "diffle.exe");

describe("retiredName", () => {
  test("uses the plain name when free, a timestamped one when taken", () => {
    expect(retiredName(target, false)).toBe(".diffle.exe.old");
    expect(retiredName(target, true, 42)).toBe(".diffle.exe.old-42");
  });

  test("recognises plain and timestamped leftovers only", () => {
    expect(isRetiredLeftover(".diffle.exe.old", target)).toBe(true);
    expect(isRetiredLeftover(".diffle.exe.old-42", target)).toBe(true);
    expect(isRetiredLeftover("diffle.exe", target)).toBe(false);
    expect(isRetiredLeftover(".diffle.exe.new", target)).toBe(false);
  });
});

describe("retireBinary", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test("moves the binary aside and clears stale leftovers", () => {
    dir = mkdtempSync(join(tmpdir(), "retire-"));
    const exe = join(dir, "diffle.exe");
    writeFileSync(exe, "current");
    writeFileSync(join(dir, ".diffle.exe.old"), "stale");
    writeFileSync(join(dir, ".diffle.exe.old-1"), "stale");
    retireBinary(exe);
    expect(readdirSync(dir)).toEqual([".diffle.exe.old"]);
  });
});
