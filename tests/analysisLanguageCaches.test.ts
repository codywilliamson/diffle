import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { csharpGroupOf } from "../src/core/analysis/languages/csharpProjects";
import { typescriptGroupOf } from "../src/core/analysis/languages/typescriptPaths";
import { createSnapshot } from "../src/core/analysis/snapshot";

let root: string;
const fresh = () => createSnapshot(root, null);
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "lang-caches-"));
  mkdirSync(join(root, "src", "app"), { recursive: true });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("per-analysis snapshot caches", () => {
  it("sees a csproj added after the first lookup only in a new snapshot", () => {
    const first = fresh();
    expect(csharpGroupOf("src/app/A.cs", root, first).id).toBe("src");
    writeFileSync(join(root, "src", "app", "App.csproj"), "<Project/>");
    expect(csharpGroupOf("src/app/A.cs", root, first).id).toBe("src");
    expect(csharpGroupOf("src/app/A.cs", root, fresh()).id).toBe("src/app/App.csproj");
  });

  it("sees a package.json added after the first lookup only in a new snapshot", () => {
    const first = fresh();
    expect(typescriptGroupOf("src/app/a.ts", root, first).id).toBe("src/app");
    writeFileSync(join(root, "src", "package.json"), "{}");
    expect(typescriptGroupOf("src/app/a.ts", root, first).id).toBe("src/app");
    expect(typescriptGroupOf("src/app/a.ts", root, fresh()).id).toBe("src");
  });

  it("terminates for paths that climb out of the root", () => {
    expect(typescriptGroupOf("../../../outside/a.ts", root, fresh()).id).toBe("../..");
    expect(typescriptGroupOf("../../../../../../../../../../../../../../../../a.ts", root, fresh()).id).toBeTruthy();
  });
});
