// the lsp endpoints against a real typescript-language-server. runs when it is on PATH (CI
// installs a pinned one) and skips cleanly otherwise.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LspPool } from "../src/core/lsp/pool";
import { findExecutable } from "../src/core/lsp/which";
import { diffFile, startHarness, type Harness } from "./helpers/lspHttp";
import { fixtureText, positionOf, prepareLspFixture } from "./helpers/lspFixture";

const server = findExecutable("typescript-language-server").path;
const SLOW_MS = 60_000;

// CI sets this so a missing install fails loudly instead of skipping the whole suite
test("the language server is installed where it is required", () => {
  if (process.env.REQUIRE_REAL_LSP) expect(server).toBeDefined();
});

describe.skipIf(!server)("lsp endpoints (real typescript-language-server)", () => {
  let root: string;
  let pool: LspPool;
  let harness: Harness;
  let usable = true;
  const main = fixtureText("src/main.ts");
  const greeter = fixtureText("src/greeter.ts");
  const text = fixtureText("src/text.ts");

  const ask = async (route: string, path: string, at: { line: number; character: number }, extra: object = {}) => {
    const res = await harness.post(route, { path, side: "new", ...at, ...extra });
    return { status: res.status, body: (await res.json()) as any };
  };

  beforeAll(async () => {
    root = prepareLspFixture(server!);
    pool = new LspPool({ root, shutdownTimeoutMs: 5000 });
    harness = startHarness(root, pool, [diffFile("src/main.ts", [5]), diffFile("src/greeter.ts", [4])]);
    // the isolated test home hides the profile volta's node shim needs; nothing to assert then
    usable = !!(await pool.ensure("typescript")) || !pool.status(["typescript"])[0]?.stderr?.includes("Volta error");
  }, SLOW_MS);
  afterAll(async () => {
    harness?.stop();
    await pool?.shutdown();
    rmSync(root, { recursive: true, force: true });
  });
  const run = (name: string, body: () => Promise<void>) => test(name, async () => { if (usable) await body(); }, SLOW_MS);

  run("definition: a class from another file, in the diff", async () => {
    const { status, body } = await ask("/api/lsp/definition", "src/main.ts", positionOf(main, "Greeter(", 0));
    expect(status).toBe(200);
    expect(body.onDefinition).toBe(false);
    expect(body.targets[0]).toMatchObject({ path: "src/greeter.ts", inRepo: true, inDiff: true, range: { start: { line: 1, character: 13 } } });
  });

  run("definition: a dependency is outside the repo and its file is readable", async () => {
    const { body } = await ask("/api/lsp/definition", "src/main.ts", positionOf(main, "double(", 0));
    const target = body.targets[0];
    expect(target).toMatchObject({ path: null, inRepo: false, inDiff: false });
    expect(target.absolutePath.replaceAll("\\", "/")).toContain("node_modules/tiny-dep/index.d.ts");
    const file = await (await harness.get(`/api/lsp/file?uri=${encodeURIComponent(target.uri)}`)).json() as any;
    expect(file.content).toContain("doubles a number");
  });

  run("definition: positions after emoji and CJK on the line", async () => {
    const at = positionOf(text, "label)", 0); // the second `label`, behind 日本語 and an emoji
    const { body } = await ask("/api/lsp/definition", "src/text.ts", at);
    expect(body.targets[0]).toMatchObject({ path: "src/text.ts", range: { start: { line: 1, character: 13 } } });
  });

  run("definition on the declaration itself says so", async () => {
    const { body } = await ask("/api/lsp/definition", "src/greeter.ts", positionOf(greeter, "Greeter", 0));
    expect(body.onDefinition).toBe(true);
  });

  run("typeDefinition jumps from a variable to its class", async () => {
    const { body } = await ask("/api/lsp/definition", "src/main.ts", positionOf(main, "greeter =", 0), { kind: "typeDefinition" });
    expect(body.targets[0]).toMatchObject({ path: "src/greeter.ts" });
  });

  run("hover returns markdown with the signature", async () => {
    const { body } = await ask("/api/lsp/hover", "src/main.ts", positionOf(main, "greet(", 0));
    expect(body.contents).toContain("greet(name: string): string");
    expect(body.range.start.line).toBe(6);
  });

  run("references are grouped, with the diff's files marked changed", async () => {
    const { body } = await ask("/api/lsp/references", "src/greeter.ts", positionOf(greeter, "greet(", 0));
    expect(body.files.map((f: any) => [f.path, f.changed])).toEqual([["src/greeter.ts", true], ["src/main.ts", true]]);
    expect(body.total).toBe(3);
    expect(body.files[1].references[0].contextLines.join("\n")).toContain("greeter.greet");
  });

  run("document symbols nest methods under the class and mark changed ones", async () => {
    const res = await harness.get("/api/lsp/symbols?path=src/greeter.ts");
    const { symbols } = await res.json() as any;
    expect(symbols[0]).toMatchObject({ name: "Greeter", kind: "class", changed: true });
    const children = Object.fromEntries(symbols[0].children.map((c: any) => [c.name, c.changed]));
    expect(children).toEqual({ constructor: false, greeting: false, greet: true, shout: false });
  });

  run("workspace symbols find a class by name", async () => {
    const { symbols } = await (await harness.get("/api/lsp/symbols?query=Greeter")).json() as any;
    expect(symbols.some((s: any) => s.name === "Greeter" && s.path === "src/greeter.ts")).toBe(true);
  });

  run("an edit on disk reaches the server before the next answer", async () => {
    writeFileSync(join(root, "src", "greeter.ts"), greeter.replace("greet(name: string): string", "greet(name: string, loud: boolean): string"));
    const { body } = await ask("/api/lsp/hover", "src/main.ts", positionOf(main, "greet(", 0));
    expect(body.contents).toContain("loud: boolean");
  });
});
