import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeDiff, churnBaseFor } from "../src/core/analysis/analyzeDiff";
import { loadReviewTarget } from "../src/core/reviewTarget";

const SETUP_TIMEOUT_MS = 30_000;
const HOT_COMMITS = 3;
let repo: string;
const git = (...args: string[]) => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "rename-churn-"));
  git("init", "-q");
  const body = Array.from({ length: 20 }, (_, i) => `export const v${i} = ${i};`);
  for (let n = 0; n < HOT_COMMITS; n++) {
    writeFileSync(join(repo, "hot.ts"), [...body, `// rev ${n}`].join("\n") + "\n");
    git("add", ".");
    git("commit", "-q", "-m", `edit ${n}`);
  }
  git("mv", "hot.ts", "renamed.ts");
  writeFileSync(join(repo, "renamed.ts"), [...body, "// rev 2", "export const extra = 1;"].join("\n") + "\n");
  git("add", ".");
}, SETUP_TIMEOUT_MS);
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("analyzeDiff churn for renames", () => {
  it("counts the old path's history against the renamed file", () => {
    const loaded = loadReviewTarget(repo, "staged");
    const card = analyzeDiff(loaded.diff, { cwd: repo, newRef: loaded.newRef, churnBase: churnBaseFor(loaded.meta) });
    const file = card.files.find((f) => f.path === "renamed.ts")!;
    expect(loaded.diff.files[0]!.oldPath).toBe("hot.ts");
    expect(file.churn).toBe(HOT_COMMITS);
  });
});
