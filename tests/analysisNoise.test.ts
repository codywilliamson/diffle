import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileNoise, linguistGenerated } from "../src/core/analysis/noise";

describe("fileNoise", () => {
  test.each([
    "package-lock.json",
    "web/pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "Cargo.lock",
    "poetry.lock",
    "Pipfile.lock",
    "uv.lock",
    "go.sum",
    "composer.lock",
    "Gemfile.lock",
    "src/App/packages.lock.json",
    "paket.lock",
  ])("%s is a lockfile", (path) => {
    expect(fileNoise(path)).toBe("lockfile");
  });

  test.each(["dist/app.min.js", "site.min.css", "bundle.js.map", "tests/__snapshots__/a.txt", "x/a.test.ts.snap", "src\\__snapshots__\\a.ts"])(
    "%s is generated",
    (path) => {
      expect(fileNoise(path)).toBe("generated");
    },
  );

  test.each(["src/index.ts", "Program.cs", "dist/app.js", "notes.lock.md", "lockfile.ts"])("%s is not noise", (path) => {
    expect(fileNoise(path)).toBeNull();
  });
});

describe("linguistGenerated", () => {
  const dir = mkdtempSync(join(tmpdir(), "diffle-attr-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("returns paths marked linguist-generated", () => {
    Bun.spawnSync(["git", "init", "-q"], { cwd: dir });
    writeFileSync(join(dir, ".gitattributes"), "gen/** linguist-generated\nkeep.ts -linguist-generated\nforced.ts linguist-generated=true\n");
    const found = linguistGenerated(["gen/a.ts", "keep.ts", "forced.ts", "src/b.ts"], dir);
    expect([...found].sort()).toEqual(["forced.ts", "gen/a.ts"]);
  });

  test("empty input and non-repo fail soft", () => {
    expect(linguistGenerated([], dir).size).toBe(0);
    const outside = mkdtempSync(join(tmpdir(), "diffle-norepo-"));
    try {
      expect(linguistGenerated(["a.ts"], outside).size).toBe(0);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
