import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMPILE_FLAGS } from "../scripts/compileFlags";
import { childCommand } from "../src/core/completionHook";
import { tempDir } from "./helpers/fakeLspPool";

const ROOT = join(import.meta.dir, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;

const NO_ENV_SHEBANG = "#!/usr/bin/env -S bun --no-env-file";
// every package.json script that starts nittle or its dev launcher from source, and the exact command it must run
const SOURCE_SCRIPTS: Record<string, string> = {
  start: "bun run client:build && bun --no-env-file src/index.ts",
  preview: "bun run client:build && bun --no-env-file src/index.ts",
  dev: "bun --no-env-file scripts/dev.ts",
  "mcp:serve": "bun --no-env-file src/mcp/index.ts",
};
const SHEBANG_ENTRYPOINTS = ["src/index.ts", "src/mcp/index.ts", "scripts/dev.ts"];

describe("nittle never loads .env from the repository under review", () => {
  it("both build scripts compile with the shared no-dotenv flags", () => {
    expect(COMPILE_FLAGS).toEqual(["--compile", "--no-compile-autoload-dotenv"]);
    for (const script of ["scripts/build-binary.ts", "scripts/build-release.ts"]) {
      expect(read(script), script).toContain("...COMPILE_FLAGS");
      expect(read(script), script).not.toMatch(/"--compile"/);
    }
  });

  for (const [name, command] of Object.entries(SOURCE_SCRIPTS)) {
    it(`package.json script "${name}" runs bun with --no-env-file`, () => {
      expect(scripts[name]).toBe(command);
    });
  }

  it("no other package.json script runs a source entrypoint with plain bun", () => {
    const known = new Set(Object.keys(SOURCE_SCRIPTS));
    const offenders = Object.entries(scripts).filter(([name, cmd]) => !known.has(name) && /bun (?!--no-env-file)(?:run )?(?:\.\/)?(src\/(?:index|mcp\/index)\.ts|scripts\/dev\.ts)/.test(cmd));
    expect(offenders).toEqual([]);
  });

  for (const file of SHEBANG_ENTRYPOINTS) {
    it(`${file} has the --no-env-file shebang`, () => {
      expect(read(file).split(/\r?\n/)[0]).toBe(NO_ENV_SHEBANG);
    });
  }

  it("the source-mode completion hook child starts with --no-env-file right after the runtime", () => {
    const command = childCommand(join(ROOT), "r1");
    expect(command).toEqual([process.execPath, "--no-env-file", join(ROOT, "src", "index.ts"), "--review-id", "r1"]);
  });

  it("the dev launcher starts its backend protected too", () => {
    expect(read("scripts/dev.ts")).toContain('spawn("bun", ["--no-env-file", join(ROOT, "src", "index.ts")');
  });

  it("a binary compiled with the flags does not see a .env marker", () => {
    const work = tempDir("dotenv");
    const entry = join(work, "entry.ts");
    const out = join(work, "probe");
    writeFileSync(entry, "console.log(`marker=${process.env.NITTLE_DOTENV_MARKER ?? 'unset'}`);\n");
    const build = Bun.spawnSync(["bun", "build", entry, ...COMPILE_FLAGS, "--outfile", out], { cwd: work });
    expect(build.exitCode).toBe(0);
    const cwd = join(work, "repo");
    mkdirSync(cwd);
    writeFileSync(join(cwd, ".env"), "NITTLE_DOTENV_MARKER=leaked\n");
    const run = Bun.spawnSync([out], { cwd, env: { ...process.env, NITTLE_DOTENV_MARKER: undefined } });
    expect(run.stdout.toString().trim()).toBe("marker=unset");
  });
});
