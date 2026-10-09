// builds a small c# solution in a temp git repo, then edits the working tree:
// a removed public method, a moved method, a todo, a package bump, a reindent, and a new lockfile.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const git = (cwd: string, ...args: string[]) => {
  const proc = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.autocrlf=false", ...args], { cwd });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
};

const project = (version: string, refs: string[] = []) =>
  [
    '<Project Sdk="Microsoft.NET.Sdk">',
    `  <ItemGroup><PackageReference Include="Newtonsoft.Json" Version="${version}" /></ItemGroup>`,
    ...refs.map((r) => `  <ItemGroup><ProjectReference Include="${r}" /></ItemGroup>`),
    "</Project>",
    "",
  ].join("\n");

const compute = [
  "    public int Compute(int a)",
  "    {",
  "        var x = a * 2;",
  "        var y = x + 1;",
  "        var z = y - 3;",
  "        return z;",
  "    }",
];

const userBefore = ["namespace Core;", "public class User", "{", "    public string Name() { return \"n\"; }", "    public int Legacy() { return 1; }", ...compute, "}", ""].join("\n");
const userAfter = ["namespace Core;", "public class User", "{", "    public string Name() { return \"n\"; } // TODO rename", "}", ""].join("\n");
const utilBefore = ["namespace Core;", "public static class Util", "{", "}", ""].join("\n");
const utilAfter = ["namespace Core;", "public static class Util", "{", ...compute, "}", ""].join("\n");

const body = (indent: string) =>
  ["alpha();", "beta();", "gamma();", "delta();"].map((s) => `${indent}${s}`);
const controller = (indent: string) =>
  ["namespace Api;", "public class UserController", "{", "    void Run()", "    {", "        if (true)", "        {", ...body(indent), "        }", "    }", "}", ""].join("\n");

const testFile = (extra: string) => ["namespace Api.Tests;", "public class UserControllerTests", "{", extra, "}", ""].join("\n");

function write(root: string, rel: string, content: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

export function makeCsharpRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "analyze-"));
  git(root, "init", "-q");
  git(root, "config", "core.autocrlf", "false");
  git(root, "config", "core.safecrlf", "false");
  write(root, "Core/Core.csproj", project("12.0.1"));
  write(root, "Core/User.cs", userBefore);
  write(root, "Core/Util.cs", utilBefore);
  write(root, "Api/Api.csproj", project("12.0.1", ["..\\Core\\Core.csproj"]));
  write(root, "Api/UserController.cs", controller("            "));
  write(root, "Api.Tests/Api.Tests.csproj", project("12.0.1", ["..\\Api\\Api.csproj"]));
  write(root, "Api.Tests/UserControllerTests.cs", testFile("    // v1"));
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "base");

  write(root, "Core/Core.csproj", project("13.0.3"));
  write(root, "Core/User.cs", userAfter);
  write(root, "Core/Util.cs", utilAfter);
  write(root, "Api/UserController.cs", controller("                "));
  write(root, "Api.Tests/UserControllerTests.cs", testFile("    // v2"));
  write(root, "Api/packages.lock.json", '{\n  "version": 1\n}\n');
  return root;
}
