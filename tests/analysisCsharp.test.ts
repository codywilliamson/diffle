import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { adapterFor } from "../src/core/analysis/languages";
import { csharpAdapter as cs } from "../src/core/analysis/languages/csharp";
import { createSnapshotReader } from "../src/core/analysis/snapshotReader";
import { makeFile } from "./fixtures/languages/makeFile";

const reasons = (path: string, rows: string[], kind: string): string[] =>
  cs.flags(makeFile(path, rows)).filter((f) => f.kind === kind).map((f) => f.reason);

describe("csharp adapter paths", () => {
  it("routes c# files and dotnet config to the adapter", () => {
    for (const p of ["a/B.cs", "a/B.csproj", "x.sln", "x.slnx", "Directory.Build.props", "a/B.razor", "global.json", "appsettings.Production.json"]) {
      expect(adapterFor(p).id).toBe("csharp");
    }
    expect(adapterFor("README.md").id).toBe("generic");
  });

  it("marks generated files as noise", () => {
    for (const p of ["a/Foo.g.cs", "a/Foo.g.i.cs", "a/Form1.Designer.cs", "a/Foo.generated.cs", "obj/Debug/X.AssemblyInfo.cs", "Data/Migrations/AppDbContextModelSnapshot.cs"]) {
      expect(cs.noise(p)).toBe("generated");
    }
    expect(cs.noise("a/Foo.cs")).toBeNull();
  });

  it("detects tests and pairs them with their subject", () => {
    expect(cs.isTest("tests/Foo.Tests/Bar.cs")).toBe(true);
    expect(cs.isTest("src/FooServiceTests.cs")).toBe(true);
    expect(cs.isTest("src/FooSpec.cs")).toBe(true);
    expect(cs.isTest("src/FooService.cs")).toBe(false);
    expect(cs.subjectName("src/FooService.cs")).toBe("fooservice");
    expect(cs.subjectName("tests/FooServiceTests.cs")).toBe("fooservice");
  });
});

describe("csharp public api flags", () => {
  it("flags a removed public method with its signature and old line", () => {
    const flags = cs.flags(makeFile("src/UserService.cs", ["   {", "-    public User GetUser(int id)", "     private int x;"], 10, 10));
    const f = flags.find((x) => x.kind === "public-api-removed");
    expect(f?.reason).toBe("removed public method `GetUser(int id)`");
    expect(f?.line).toBe(11);
  });

  it("flags added protected and public types and properties", () => {
    const r = reasons("src/A.cs", ["+public sealed class Foo", "+protected string Name { get; set; }", "+public record Bar(int X);", "+private int hidden;"], "public-api-added");
    expect(r).toEqual(["added public class `Foo`", "added protected property `Name`", "added public record `Bar`"]);
  });

  it("ignores a signature that only moved", () => {
    const file = makeFile("src/A.cs", ["-    public int Count()", "     // other", "+    public int Count()"]);
    expect(cs.flags(file).filter((f) => f.kind.startsWith("public-api"))).toEqual([]);
  });

  it("ignores body-only edits of a method but flags a changed signature", () => {
    const body = makeFile("src/A.cs", ["-public int Count() => 1;", "+public int Count() => 2;"]);
    expect(cs.flags(body).some((f) => f.kind.startsWith("public-api"))).toBe(false);
    const sig = makeFile("src/A.cs", ["-public int Count()", "+public long Count()"]);
    expect(cs.flags(sig).map((f) => f.kind).sort()).toEqual(["public-api-added", "public-api-removed"]);
  });

  it("skips test files", () => {
    expect(reasons("tests/FooTests.cs", ["+public class FooTests"], "public-api-added")).toEqual([]);
  });
});

describe("csharp dependency flags", () => {
  const csproj = (rows: string[]): string[] => reasons("src/App/App.csproj", rows, "dependency");

  it("flags a package version bump with both versions", () => {
    expect(csproj(['-    <PackageReference Include="Serilog" Version="3.0.0" />', '+    <PackageReference Include="Serilog" Version="3.1.1" />'])).toEqual([
      "changed dependency Serilog from 3.0.0 to 3.1.1",
    ]);
  });

  it("flags added and removed packages and target framework changes", () => {
    expect(csproj(['+<PackageReference Include="Dapper" Version="2.1.0" />', '-<PackageReference Include="Old" Version="1.0.0" />'])).toEqual([
      "added dependency Dapper 2.1.0",
      "removed dependency Old 1.0.0",
    ]);
    expect(csproj(["-<TargetFramework>net8.0</TargetFramework>", "+<TargetFramework>net10.0</TargetFramework>"])).toEqual([
      "changed dependency TargetFramework from net8.0 to net10.0",
    ]);
  });

  it("handles central package management and global.json", () => {
    expect(reasons("Directory.Packages.props", ['-<PackageVersion Include="Xunit" Version="2.5.0" />', '+<PackageVersion Include="Xunit" Version="2.9.0" />'], "dependency")).toHaveLength(1);
    expect(reasons("global.json", ['-    "version": "8.0.100"', '+    "version": "10.0.100"'], "dependency")[0]).toContain("10.0.100");
  });
});

describe("csharp leftover and sensitive flags", () => {
  it("flags risky added lines only", () => {
    const rows = [
      "+Debugger.Break();",
      "+#pragma warning disable CS8618",
      '+[Fact(Skip = "flaky")]',
      "+[Ignore]",
      "+public async void DoWork()",
      "+private async void OnClick(object sender, EventArgs e)",
      "+var x = task.Result;",
      "+task.Wait();",
      "+t.GetAwaiter().GetResult();",
      "+// TODO: fix",
      "+var n = null!;",
      "-Debugger.Break();",
      "+// calls task.Result in a comment",
    ];
    const r = reasons("src/A.cs", rows, "leftover");
    expect(r).toHaveLength(10);
    expect(r.some((x) => x.includes("OnClick"))).toBe(false);
  });

  it("flags sensitive paths", () => {
    for (const p of ["src/Data/Migrations/20240101_Init.cs", "src/Program.cs", "src/appsettings.json", "src/App/App.csproj", "src/Auth/Token.cs", "web.config", "Directory.Build.props"]) {
      expect(cs.flags(makeFile(p, ["+x"])).some((f) => f.kind === "sensitive-path")).toBe(true);
    }
    expect(cs.flags(makeFile("src/Plain.cs", ["+x"]))).toEqual([]);
  });
});

describe("csharp groups", () => {
  const root = mkdtempSync(join(tmpdir(), "diffle-cs-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const write = (rel: string, body: string): void => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  };
  write("src/Core/Core.csproj", "<Project />");
  write("src/Core/Models/User.cs", "class User {}");
  write("src/Api/Api.csproj", '<Project><ItemGroup><ProjectReference Include="..\\Core\\Core.csproj" /></ItemGroup></Project>');
  write(
    "tests/Api.Tests/Api.Tests.csproj",
    '<Project><ItemGroup><ProjectReference Include="../../src/Api/Api.csproj" /><ProjectReference Include="../../src/Missing/Missing.csproj" /></ItemGroup></Project>',
  );

  it("groups by nearest csproj, including deleted files in missing folders", () => {
    expect(cs.groupOf("src/Core/Models/User.cs", root)).toEqual({ id: "src/Core/Core.csproj", label: "Core" });
    expect(cs.groupOf("src/Core/Gone/Old.cs", root)).toEqual({ id: "src/Core/Core.csproj", label: "Core" });
    expect(cs.groupOf("src/Api/Api.csproj", root)).toEqual({ id: "src/Api/Api.csproj", label: "Api" });
  });

  it("falls back to the top-level folder", () => {
    expect(cs.groupOf("docs/Notes.cs", root)).toEqual({ id: "docs", label: "docs" });
    expect(cs.groupOf("App.sln", root)).toEqual({ id: "(root)", label: "(root)" });
  });

  it("maps project references to other listed groups", () => {
    const ids = ["src/Core/Core.csproj", "src/Api/Api.csproj", "tests/Api.Tests/Api.Tests.csproj", "docs"];
    expect(cs.groupDependencies?.(ids, root, createSnapshotReader(root, null))).toEqual({
      "src/Core/Core.csproj": [],
      "src/Api/Api.csproj": ["src/Core/Core.csproj"],
      "tests/Api.Tests/Api.Tests.csproj": ["src/Api/Api.csproj"],
      docs: [],
    });
  });
});
