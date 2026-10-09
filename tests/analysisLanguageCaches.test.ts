import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetLanguageCaches } from "../src/core/analysis/languages";
import { csharpGroupOf } from "../src/core/analysis/languages/csharpProjects";
import { typescriptGroupOf } from "../src/core/analysis/languages/typescriptPaths";

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "lang-caches-"));
  mkdirSync(join(root, "src", "app"), { recursive: true });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("per-analysis language caches", () => {
  it("sees a csproj added after the first lookup once caches reset", () => {
    expect(csharpGroupOf("src/app/A.cs", root).id).toBe("src");
    writeFileSync(join(root, "src", "app", "App.csproj"), "<Project/>");
    expect(csharpGroupOf("src/app/A.cs", root).id).toBe("src");
    resetLanguageCaches();
    expect(csharpGroupOf("src/app/A.cs", root).id).toBe("src/app/App.csproj");
  });

  it("sees a package.json added after the first lookup once caches reset", () => {
    expect(typescriptGroupOf("src/app/a.ts", root).id).toBe("src/app");
    writeFileSync(join(root, "src", "package.json"), "{}");
    resetLanguageCaches();
    expect(typescriptGroupOf("src/app/a.ts", root).id).toBe("src");
  });

  it("terminates for paths that climb out of the root", () => {
    resetLanguageCaches();
    expect(typescriptGroupOf("../../../outside/a.ts", root).id).toBe("../..");
    expect(typescriptGroupOf("../../../../../../../../../../../../../../../../a.ts", root).id).toBeTruthy();
  });
});
