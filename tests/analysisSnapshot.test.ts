import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createSnapshot } from "../src/core/analysis/snapshot";
import { orderReview } from "../src/core/analysis/reviewOrder";
import { runGit } from "../src/utils/git";
import { analysis } from "./fixtures/analysis/fileAnalysis";

const SETUP_TIMEOUT_MS = 30_000;
const proj = (refs: string[]) =>
  `<Project>${refs.map((r) => `<ItemGroup><ProjectReference Include="${r}" /></ItemGroup>`).join("")}</Project>`;
const A = "A/A.csproj";
const B = "B/B.csproj";
let root: string;
let refSha: string;

const put = (rel: string, body: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const groupLabels = (newRef: string | null) =>
  orderReview([analysis("A/X.cs"), analysis("B/Y.cs")], root, createSnapshot(root, newRef)).groups.map((g) => g.label);

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "snapshot-"));
  runGit(["init", "-q"], root);
  runGit(["config", "user.email", "t@t.t"], root);
  runGit(["config", "user.name", "t"], root);
  put(A, proj([]));
  put(B, proj([]));
  runGit(["add", "-A"], root);
  runGit(["commit", "-qm", "base"], root);
  put(A, proj(["../B/B.csproj"])); // a references b
  runGit(["add", "-A"], root);
  runGit(["commit", "-qm", "a references b"], root);
  refSha = runGit(["rev-parse", "HEAD"], root).trim();
  put(B, proj(["../A/A.csproj"])); // staged: b references a
  runGit(["add", "-A"], root);
  put(B, proj([])); // working tree drops the staged reference again
}, SETUP_TIMEOUT_MS);
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("snapshot reader", () => {
  it("reads the working tree, the index, and a ref, and returns null for missing files", () => {
    expect(createSnapshot(root, null).read(B)).toBe(proj([]));
    expect(createSnapshot(root, "").read(B)).toBe(proj(["../A/A.csproj"]));
    expect(createSnapshot(root, refSha).read(B)).toBe(proj([]));
    expect(createSnapshot(root, refSha).read("nope.csproj")).toBeNull();
    expect(createSnapshot(root, null).read("nope.csproj")).toBeNull();
  });

  it("orders a staged review by the staged reference", () => {
    expect(groupLabels("")).toEqual(["A", "B"]);
  });

  it("orders a ref review by the ref's content", () => {
    expect(groupLabels(refSha)).toEqual(["B", "A"]);
  });
});
