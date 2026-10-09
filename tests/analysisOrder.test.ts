import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { orderReview } from "../src/core/analysis/reviewOrder";
import { analysis } from "./fixtures/analysis/fileAnalysis";

let root: string;
const put = (rel: string, body = "") => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const proj = (refs: string[] = []) =>
  `<Project Sdk="Microsoft.NET.Sdk">${refs.map((r) => `<ItemGroup><ProjectReference Include="${r}" /></ItemGroup>`).join("")}</Project>`;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "order-"));
  put("Core/Core.csproj", proj());
  put("Api/Api.csproj", proj(["..\\Core\\Core.csproj"]));
  put("Api.Tests/Api.Tests.csproj", proj(["..\\Api\\Api.csproj"]));
  put("Cyc/A/A.csproj", proj(["..\\B\\B.csproj"]));
  put("Cyc/B/B.csproj", proj(["..\\A\\A.csproj"]));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const paths = (files: { path: string }[]) => files.map((f) => f.path);

describe("orderReview", () => {
  it("reviews referenced projects first, tests last", () => {
    const files = [
      analysis("Api.Tests/UserServiceTests.cs", { isTest: true }),
      analysis("Api/UserController.cs"),
      analysis("Core/User.cs"),
    ];
    const { groups, ordered } = orderReview(files, root);
    expect(groups.map((g) => g.label)).toEqual(["Core", "Api", "Api.Tests"]);
    expect(paths(ordered)).toEqual(["Core/User.cs", "Api/UserController.cs", "Api.Tests/UserServiceTests.cs"]);
  });

  it("breaks cycles alphabetically", () => {
    const { groups } = orderReview([analysis("Cyc/B/B.cs"), analysis("Cyc/A/A.cs")], root);
    expect(groups.map((g) => g.label)).toEqual(["A", "B"]);
  });

  it("collects every noise file into one final group", () => {
    const files = [
      analysis("zeta/lock.json", { noise: "lockfile" }),
      analysis("alpha/a.py"),
      analysis("alpha/gen.py", { noise: "generated" }),
      analysis("beta/b.py"),
    ];
    const { groups, ordered } = orderReview(files, root);
    expect(groups.map((g) => g.label)).toEqual(["alpha", "beta", "Generated & lockfiles"]);
    expect(groups.at(-1)).toEqual({ id: "noise", label: "Generated & lockfiles", files: ["alpha/gen.py", "zeta/lock.json"] });
    expect(ordered).toHaveLength(4);
  });

  it("places each test right after its source and unpaired tests last", () => {
    const files = [
      analysis("src/b.py", { testPair: "src/b_test.py" }),
      analysis("src/b_test.py", { isTest: true, testPair: "src/b.py" }),
      analysis("src/a.py"),
      analysis("src/lone_test.py", { isTest: true }),
      analysis("src/c.py"),
    ];
    const { groups } = orderReview(files, root);
    expect(groups[0]!.files).toEqual(["src/a.py", "src/b.py", "src/b_test.py", "src/c.py", "src/lone_test.py"]);
  });

  it("is deterministic regardless of input order", () => {
    const files = [analysis("x/1.py"), analysis("y/2.py"), analysis("z/3.py", { noise: "generated" })];
    expect(orderReview([...files].reverse(), root)).toEqual(orderReview(files, root));
  });
});
