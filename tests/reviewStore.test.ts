import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReviewFile } from "../src/types";
import { readReview, writeReview } from "../src/core/reviewStore";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures", "sample.review.json"), "utf8"),
) as ReviewFile;

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "diffle-review-"));
  dirs.push(dir);
  return dir;
}

// a real repo, so `git rev-parse --git-path` and `git check-ignore` behave as they do in anger.
function tempRepo(): string {
  const dir = tempDir();
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: dir });
  return dir;
}

function excludeLines(dir: string): string[] {
  const path = join(dir, ".git", "info", "exclude");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).map((l) => l.trim());
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("reviewStore", () => {
  it("reads an existing .review correctly", () => {
    const dir = tempDir();
    writeFileSync(join(dir, ".review"), JSON.stringify(fixture));
    expect(readReview(dir)).toEqual(fixture);
  });

  it("write then read round-trips an identical object", () => {
    const dir = tempDir();
    writeReview(dir, fixture);
    expect(readReview(dir)).toEqual(fixture);
  });

  it("returns null when no .review exists", () => {
    expect(readReview(tempDir())).toBeNull();
  });

  it("creates the .review file on first write", () => {
    const dir = tempDir();
    expect(existsSync(join(dir, ".review"))).toBe(false);
    writeReview(dir, fixture);
    expect(existsSync(join(dir, ".review"))).toBe(true);
  });

  it("adds .review to .git/info/exclude", () => {
    const dir = tempRepo();
    writeReview(dir, fixture);
    expect(excludeLines(dir)).toContain(".review");
  });

  it("never touches the tracked .gitignore", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, ".gitignore"), "node_modules\n");
    writeReview(dir, fixture);
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toBe("node_modules\n");
  });

  it("does not duplicate the exclude entry on a second write", () => {
    const dir = tempRepo();
    writeReview(dir, fixture);
    writeReview(dir, fixture);
    expect(excludeLines(dir).filter((l) => l === ".review")).toHaveLength(1);
  });

  it("leaves the exclude file alone when .gitignore already covers .review", () => {
    const dir = tempRepo();
    writeFileSync(join(dir, ".gitignore"), ".review\n");
    writeReview(dir, fixture);
    expect(excludeLines(dir)).not.toContain(".review");
  });

  it("skips the exclude write when the user opted into reviewing .review", () => {
    const dir = tempRepo();
    writeReview(dir, fixture, false);
    expect(excludeLines(dir)).not.toContain(".review");
    expect(existsSync(join(dir, ".review"))).toBe(true);
  });

  it("does nothing outside a git repo", () => {
    const dir = tempDir();
    writeReview(dir, fixture);
    expect(existsSync(join(dir, ".review"))).toBe(true);
    expect(existsSync(join(dir, ".gitignore"))).toBe(false);
  });

  const emptyReview: ReviewFile = {
    meta: { ref: "x", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    viewed: [],
    comments: [],
  };

  it("does not create .review when there are no comments yet (viewed-only)", () => {
    const dir = tempDir();
    writeReview(dir, { ...emptyReview, viewed: ["a.ts"] });
    expect(existsSync(join(dir, ".review"))).toBe(false);
  });

  it("leaves the exclude file untouched when there is nothing to save", () => {
    const dir = tempRepo();
    writeReview(dir, emptyReview);
    expect(excludeLines(dir)).not.toContain(".review");
  });

  it("keeps updating an existing .review even after its comments are cleared", () => {
    const dir = tempDir();
    writeReview(dir, fixture); // creates it — fixture has comments
    writeReview(dir, { ...fixture, comments: [], viewed: ["x.ts"] });
    const saved = readReview(dir);
    expect(saved?.comments).toEqual([]);
    expect(saved?.viewed).toEqual(["x.ts"]);
  });
});
