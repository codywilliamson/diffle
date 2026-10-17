import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchReview } from "../src/core/reviewLaunch";
import { readReviewRecord } from "../src/core/reviewRecords";
import { loadReviewTarget } from "../src/core/reviewTarget";
import { helpFor, parseCliArgs, USAGE } from "../src/utils/cli";

const root = join(import.meta.dir, "..");
const run = (args: string[], cwd: string) => {
  const proc = Bun.spawnSync(["git", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
  return proc.stdout.toString().trim();
};
const write = (name: string, text: string) => writeFileSync(join(repo, name), text);
const commit = (message: string) => { run(["add", "-A"], repo); run(["commit", "-q", "-m", message], repo); return run(["rev-parse", "HEAD"], repo); };

let repo: string;
let data: string;
let rootHash: string;
let secondHash: string;
let mergeHash: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "nittle-show-repo-"));
  data = mkdtempSync(join(tmpdir(), "nittle-show-data-"));
  process.env.NITTLE_DATA_DIR = data;
  run(["init", "-q", "-b", "main"], repo);
  run(["config", "user.name", "Ada"], repo);
  run(["config", "user.email", "ada@example.com"], repo);
  write("a.txt", "one\n");
  rootHash = commit("first commit");
  write("a.txt", "one\ntwo\n");
  secondHash = commit("second commit\n\nbody line one\nbody line two");
  run(["checkout", "-q", "-b", "side"], repo);
  write("side.txt", "side\n");
  commit("side work");
  run(["checkout", "-q", "main"], repo);
  write("main.txt", "main\n");
  commit("main work");
  run(["merge", "-q", "--no-ff", "-m", "merge side", "side"], repo);
  mergeHash = run(["rev-parse", "HEAD"], repo);
});
afterAll(() => {
  delete process.env.NITTLE_DATA_DIR;
  rmSync(repo, { recursive: true, force: true });
  rmSync(data, { recursive: true, force: true });
});

const paths = (spec: string) => loadReviewTarget(repo, spec).diff.files.map((f) => f.path);

describe("nittle show", () => {
  it("parses show with and without a rev", () => {
    expect(parseCliArgs(["show"]).spec).toBe("HEAD^!");
    expect(parseCliArgs(["show", "abc123", "--no-open"])).toMatchObject({ command: "show", spec: "abc123^!", open: false });
    expect(() => parseCliArgs(["show", "a", "b"])).toThrow("only one ref");
  });

  it("documents show in usage and per-command help", () => {
    expect(USAGE).toContain("show [rev]");
    expect(helpFor("show")).toContain("show [rev]");
  });

  it("a <rev>^! spec resolves, and show gives the same diff", () => {
    const viaShorthand = loadReviewTarget(repo, `${secondHash}^!`).diff.files;
    const viaShow = loadReviewTarget(repo, parseCliArgs(["show", secondHash]).spec).diff.files;
    expect(viaShow).toEqual(viaShorthand);
    expect(viaShow.map((f) => f.path)).toEqual(["a.txt"]);
  });

  it("show with no rev reviews HEAD", () => {
    const head = loadReviewTarget(repo, parseCliArgs(["show"]).spec);
    expect(head.meta?.commit?.hash).toBe(mergeHash);
    expect(head.meta?.mode).toBe("commit");
  });

  it("an explicit rev carries the commit message, author and date", () => {
    const { commit: info } = loadReviewTarget(repo, `${secondHash}^!`).meta ?? {};
    expect(info).toMatchObject({ hash: secondHash, subject: "second commit", body: "body line one\nbody line two", author: "Ada", isMerge: false });
    expect(info?.shortHash).toBe(secondHash.slice(0, info?.shortHash.length));
    expect(Number.isNaN(Date.parse(info?.date ?? ""))).toBe(false);
  });

  it("a root commit diffs against the empty tree", () => {
    const loaded = loadReviewTarget(repo, `${rootHash}^!`);
    expect(loaded.diff.files.map((f) => f.path)).toEqual(["a.txt"]);
    expect(loaded.diff.files[0]?.changeType).toBe("added");
    expect(loaded.meta?.commit?.baseShortHash).toBeNull();
    expect(loaded.meta?.target).toBe("empty tree");
  });

  it("a merge commit diffs against its first parent", () => {
    const loaded = loadReviewTarget(repo, `${mergeHash}^!`);
    const firstParent = run(["rev-parse", `${mergeHash}^1`], repo);
    expect(paths(`${mergeHash}^!`)).toEqual(["side.txt"]);
    expect(loaded.meta?.commit?.isMerge).toBe(true);
    expect(loaded.meta?.commit?.baseShortHash).toBe(firstParent.slice(0, 7));
  });

  it("rejects an unknown commit", () => {
    expect(() => loadReviewTarget(repo, "nope^!")).toThrow("unknown commit: nope");
  });

  it("rejects option-shaped revs and creates no file", () => {
    const out = join(data, "injected.txt");
    expect(() => loadReviewTarget(repo, `--output=${out}^!`)).toThrow("can't start with");
    expect(() => loadReviewTarget(repo, "--no-such^!")).toThrow("can't start with");
    expect(existsSync(out)).toBe(false);
  });

  it("rejects ranges and revision sets instead of reviewing one commit", () => {
    for (const spec of ["HEAD~2..HEAD^!", "main...side^!", "^main side^!", "HEAD HEAD~1^!"]) {
      expect(() => loadReviewTarget(repo, spec)).toThrow("one commit");
    }
  });

  it("the review record pins the full hash, so reopening survives HEAD moving", () => {
    const launch = launchReview({ cwd: repo, productRoot: root, spec: "HEAD~1^!", open: false, host: "mcp" });
    launch.server.stop(true);
    const pinned = run(["rev-parse", "HEAD~1"], repo);
    const record = readReviewRecord(launch.review.id);
    expect(record?.target.spec).toBe(`${pinned}^!`);
    const before = launch.diff.files.map((f) => f.path);
    write("later.txt", "x\n");
    commit("later");
    const reopened = launchReview({ cwd: repo, productRoot: root, reviewId: launch.review.id, open: false, host: "mcp" });
    reopened.server.stop(true);
    expect(reopened.diff.files.map((f) => f.path)).toEqual(before);
    expect(reopened.diff.meta?.commit?.hash).toBe(pinned);
  });
});
