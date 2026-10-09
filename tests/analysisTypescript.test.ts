import { createSnapshot } from "../src/core/analysis/snapshot";
import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adapterFor } from "../src/core/analysis/languages";
import { typescriptAdapter as ts } from "../src/core/analysis/languages/typescript";
import { makeFile } from "./fixtures/languages/makeFile";

const reasons = (path: string, rows: string[], kind: string): string[] =>
  ts.flags(makeFile(path, rows)).filter((f) => f.kind === kind).map((f) => f.reason);

describe("typescript adapter paths", () => {
  it("routes ts/js files and package.json", () => {
    for (const p of ["a.ts", "a.tsx", "a.js", "a.mjs", "a.svelte", "a.vue", "package.json"]) expect(adapterFor(p).id).toBe("typescript");
    expect(adapterFor("a.py").id).toBe("generic");
  });

  it("marks generated files", () => {
    expect(ts.noise("src/api.generated.ts")).toBe("generated");
    expect(ts.noise("src/api.gen.ts")).toBe("generated");
    expect(ts.noise("src/api.ts")).toBeNull();
  });

  it("detects tests and pairs with the subject", () => {
    for (const p of ["src/a.test.ts", "src/a.spec.tsx", "e2e/a.pw.ts", "src/__tests__/a.ts"]) expect(ts.isTest(p)).toBe(true);
    expect(ts.isTest("src/a.ts")).toBe(false);
    expect(ts.subjectName("src/a.ts")).toBe(ts.subjectName("src/a.test.ts"));
    expect(ts.subjectName("e2e/Review.pw.ts")).toBe("review");
  });
});

describe("typescript flags", () => {
  it("flags added and removed exports but not moved ones", () => {
    expect(reasons("src/a.ts", ["+export function load(id: string): Item {", "+export const MAX = 3;", "+export default class X {}", "+function hidden() {}"], "public-api-added")).toEqual([
      "added exported function `load(id: string)`",
      "added exported const `MAX`",
      "added exported default",
    ]);
    expect(reasons("src/a.ts", ["-export interface Item {"], "public-api-removed")).toEqual(["removed exported interface `Item`"]);
    expect(ts.flags(makeFile("src/a.ts", ["-export const MAX = 3;", "+export const MAX = 4;"])).filter((f) => f.kind.startsWith("public-api"))).toEqual([]);
  });

  it("flags package.json dependency changes", () => {
    const rows = [
      '-    "svelte": "5.0.0",',
      '+    "svelte": "5.1.0",',
      '+    "zod": "^3.22.0",',
      '-    "left-pad": "1.0.0"',
      '-  "version": "1.0.0",',
      '+  "version": "1.1.0",',
      '+    "test": "bun test",',
    ];
    expect(reasons("package.json", rows, "dependency")).toEqual([
      "changed dependency svelte from 5.0.0 to 5.1.0",
      "added dependency zod ^3.22.0",
      "removed dependency left-pad 1.0.0",
    ]);
  });

  it("flags leftovers on added lines", () => {
    const rows = ["+console.log(x)", "+  debugger;", "+it.only('a', () => {})", "+describe.skip('b', () => {})", "+// @ts-ignore", "+// eslint-disable-next-line", "+const a = b as any;", "+// FIXME later", "-console.log(old)", "+// console.log in a comment"];
    expect(reasons("src/a.ts", rows, "leftover")).toHaveLength(8);
  });

  it("flags sensitive paths", () => {
    for (const p of [".github/workflows/ci.yml", "src/auth/login.ts", ".env.local", "db/migrations/001.ts", "src/security/x.ts"]) {
      expect(ts.flags(makeFile(p, ["+x"])).some((f) => f.kind === "sensitive-path")).toBe(true);
    }
  });
});

describe("typescript groups", () => {
  const root = mkdtempSync(join(tmpdir(), "diffle-ts-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "web/src"), { recursive: true });
  writeFileSync(join(root, "web/package.json"), "{}");
  writeFileSync(join(root, "package.json"), "{}");

  it("treats the root package.json as no group, even with a nested package beside it", () => {
    mkdirSync(join(root, "packages/x/src"), { recursive: true });
    writeFileSync(join(root, "packages/x/package.json"), "{}");
    const snap = createSnapshot(root, null);
    expect(ts.groupOf("packages/x/src/a.ts", root, snap)).toEqual({ id: "packages/x", label: "packages/x" });
    expect(ts.groupOf("packages/y/b.ts", root, snap)).toEqual({ id: "packages/y", label: "packages/y" });
    expect(ts.groupOf("src/lib/c.ts", root, snap)).toEqual({ id: "src/lib", label: "src/lib" });
  });

  it("uses a nested package folder, else the first two folders", () => {
    expect(ts.groupOf("web/src/a.ts", root, createSnapshot(root, null))).toEqual({ id: "web", label: "web" });
    expect(ts.groupOf("src/core/a.ts", root, createSnapshot(root, null))).toEqual({ id: "src/core", label: "src/core" });
    expect(ts.groupOf("client/src/lib/a.ts", root, createSnapshot(root, null))).toEqual({ id: "client/src", label: "client/src" });
    expect(ts.groupOf("src/index.ts", root, createSnapshot(root, null))).toEqual({ id: "src", label: "src" });
    expect(ts.groupOf("vite.config.ts", root, createSnapshot(root, null))).toEqual({ id: "(root)", label: "(root)" });
  });
});

describe("typescript export identity", () => {
  const apiFlags = (rows: string[]) => ts.flags(makeFile("src/a.ts", rows)).filter((f) => f.kind.startsWith("public-api"));

  it("ignores a one-line function body edit", () => {
    expect(apiFlags(["-export function answer() { return 1; }", "+export function answer() { return 2; }"])).toEqual([]);
  });

  it("still flags a changed one-line signature", () => {
    expect(apiFlags(["-export function answer() { return 1; }", "+export function answer(n: number) { return 1; }"]).map((f) => f.kind)).toEqual([
      "public-api-removed",
      "public-api-added",
    ]);
  });

  it("keys arrow function consts on the name only", () => {
    expect(apiFlags(["-export const f = (a) => a + 1;", "+export const f = (a) => a + 2;"])).toEqual([]);
  });
});
