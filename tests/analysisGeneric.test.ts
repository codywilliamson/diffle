import { createSnapshot } from "../src/core/analysis/snapshot";
import { describe, expect, it } from "bun:test";
import { ADAPTERS, adapterFor } from "../src/core/analysis/languages";
import { genericAdapter as gen } from "../src/core/analysis/languages/generic";
import { makeFile } from "./fixtures/languages/makeFile";

describe("generic adapter", () => {
  it("is the last adapter and matches everything", () => {
    expect(ADAPTERS.at(-1)).toBe(gen);
    expect(adapterFor("main.go")).toBe(gen);
    expect(adapterFor("lib/Foo.cs").id).toBe("csharp");
  });

  it("has no noise", () => {
    expect(gen.noise("go.sum")).toBeNull();
  });

  it("detects tests by folder and name", () => {
    for (const p of ["tests/a.py", "pkg/spec/a.rb", "a_test.go", "test_a.py", "a.spec.rb"]) expect(gen.isTest(p)).toBe(true);
    expect(gen.isTest("src/a.py")).toBe(false);
  });

  it("pairs a test with its subject", () => {
    expect(gen.subjectName("pkg/a_test.go")).toBe("a");
    expect(gen.subjectName("tests/test_parser.py")).toBe("parser");
    expect(gen.subjectName("pkg/Parser.go")).toBe("parser");
  });

  it("groups by top-level folder or (root)", () => {
    expect(gen.groupOf("cmd/main.go", "/x", createSnapshot("/x", null))).toEqual({ id: "cmd", label: "cmd" });
    expect(gen.groupOf("Makefile", "/x", createSnapshot("/x", null))).toEqual({ id: "(root)", label: "(root)" });
  });

  it("flags todo markers on added lines only", () => {
    const flags = gen.flags(makeFile("a.go", ["+// TODO: x", "-// TODO: old", "+ok"], 1, 5));
    expect(flags).toEqual([{ kind: "leftover", reason: "unfinished-work marker added: `// TODO: x`", line: 5 }]);
  });

  it("flags sensitive paths", () => {
    for (const p of [".github/workflows/ci.yml", "Dockerfile", "docker-compose.yml", ".env", "db/migrations/1.sql", "auth/x.go", ".gitlab-ci.yml", "azure-pipelines.yml", "Jenkinsfile"]) {
      expect(gen.flags(makeFile(p, ["+x"])).map((f) => f.kind)).toEqual(["sensitive-path"]);
    }
  });
});
