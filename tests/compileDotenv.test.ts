import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMPILE_FLAGS } from "../scripts/compileFlags";
import { tempDir } from "./helpers/fakeLspPool";

const ROOT = join(import.meta.dir, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

describe("compiled binaries ignore .env in the cwd", () => {
  it("the release and host build scripts both compile with the shared flags", () => {
    expect(COMPILE_FLAGS).toContain("--no-compile-autoload-dotenv");
    for (const script of ["scripts/build-binary.ts", "scripts/build-release.ts"]) {
      expect(read(script), script).toContain("...COMPILE_FLAGS");
      expect(read(script), script).not.toMatch(/"--compile"/);
    }
  });

  it("source-mode launchers disable .env loading too", () => {
    expect(read("scripts/dev.ts")).toContain('"--no-env-file"');
    for (const line of read("package.json").split("\n").filter((l) => l.includes("bun ") && l.includes("src/index.ts"))) expect(line).toContain("--no-env-file");
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
