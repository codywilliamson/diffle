import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { csharpGroupOf } from "../src/core/analysis/languages/csharpProjects";
import { typescriptGroupOf } from "../src/core/analysis/languages/typescriptPaths";
import { createSnapshot } from "../src/core/analysis/snapshot";
import { runGit } from "../src/utils/git";

const SETUP_TIMEOUT_MS = 30_000;
let root: string;
let refSha: string;

const put = (rel: string, body = "x") => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "snapshot-groups-"));
  runGit(["init", "-q"], root);
  runGit(["config", "user.email", "t@t.t"], root);
  runGit(["config", "user.name", "t"], root);
  put("Old/Old.csproj");
  put("Old/Thing.cs");
  put("web/package.json");
  put("web/a.ts");
  runGit(["add", "-A"], root);
  runGit(["commit", "-qm", "base"], root);
  refSha = runGit(["rev-parse", "HEAD"], root).trim();
  rmSync(join(root, "Old/Old.csproj")); // gone from the checkout, still at the ref
  rmSync(join(root, "web/package.json"));
  put("New/New.csproj"); // only in the checkout
  put("New/Thing.cs");
  put("fresh/package.json");
  put("fresh/b.ts");
}, SETUP_TIMEOUT_MS);
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("snapshot directory listing", () => {
  it("lists direct children on the working tree, the index, and a ref", () => {
    runGit(["add", "New/New.csproj"], root);
    expect(createSnapshot(root, null).list("Old")).toEqual(["Thing.cs"]);
    expect(createSnapshot(root, refSha).list("Old").sort()).toEqual(["Old.csproj", "Thing.cs"]);
    expect(createSnapshot(root, "").list("New")).toEqual(["New.csproj"]);
    expect(createSnapshot(root, refSha).list("New")).toEqual([]);
    runGit(["reset", "-q", "New/New.csproj"], root);
  });
});

describe("snapshot-aware groups", () => {
  it("a project that exists only at the ref still owns its files in a ref review", () => {
    expect(csharpGroupOf("Old/Thing.cs", root, createSnapshot(root, refSha)).id).toBe("Old/Old.csproj");
    expect(csharpGroupOf("Old/Thing.cs", root, createSnapshot(root, null)).id).toBe("Old");
    expect(typescriptGroupOf("web/a.ts", root, createSnapshot(root, refSha)).id).toBe("web");
  });

  it("a project that exists only in the checkout does not own files in a ref review", () => {
    expect(csharpGroupOf("New/Thing.cs", root, createSnapshot(root, null)).id).toBe("New/New.csproj");
    expect(csharpGroupOf("New/Thing.cs", root, createSnapshot(root, refSha)).id).toBe("New");
    expect(typescriptGroupOf("fresh/b.ts", root, createSnapshot(root, refSha)).id).toBe("fresh");
    expect(typescriptGroupOf("fresh/b.ts", root, createSnapshot(root, null)).id).toBe("fresh");
  });
});
