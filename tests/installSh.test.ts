import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ASSET, createInstallSandbox, type InstallSandbox, type SandboxOptions } from "./helpers/installSh";

// install.sh is unix-only; under git bash on windows each run takes seconds, so ci skips it there
const sh = process.platform === "win32" && process.env.CI ? null : Bun.which("sh");
setDefaultTimeout(60_000);
let sandbox: InstallSandbox | undefined;
const open = (options?: SandboxOptions) => (sandbox = createInstallSandbox(options));
afterEach(() => sandbox?.cleanup());

const write = (path: string, text: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
const read = (path: string) => readFileSync(path, "utf8");
// same dir on posix and under git bash on windows (drive letters, slashes)
const norm = (path: string) => path.replaceAll("\\", "/").replace(/^\/?([A-Za-z]):?\//, "$1/").toLowerCase();
const OLD_BLOCK = (dir: string) => `\n# >>> diffle >>>\nexport PATH="${dir}:$PATH"\n# <<< diffle <<<\n`;

describe.skipIf(!sh)("install.sh", () => {
  test("installs the nittle asset into ~/.nittle/bin and writes a nittle marker block", async () => {
    const box = open();
    const result = await box.run();
    expect(result.code).toBe(0);
    expect(existsSync(join(box.home, ".nittle", "bin", "nittle"))).toBe(true);
    expect(existsSync(join(box.home, ".diffle"))).toBe(false);
    const rc = read(join(box.home, ".zshrc"));
    expect(rc).toContain("# >>> nittle >>>");
    expect(rc).toContain(".nittle/bin:$PATH");
    expect(rc).not.toContain("diffle");
    expect(read(box.log)).toBe("");
  });

  test("a rerun leaves the rc file alone and backups never carry the old name", async () => {
    const box = open();
    write(join(box.home, ".zshrc"), "alias a=b\n");
    await box.run();
    const once = read(join(box.home, ".zshrc"));
    await box.run();
    expect(read(join(box.home, ".zshrc")).split("# >>> nittle >>>").length).toBe(2);
    expect(once).toContain("alias a=b");
    const backups = readdirSync(box.home).filter((name) => name.includes(".bak-"));
    expect(backups.length).toBeGreaterThan(0);
    expect(backups.every((name) => name.includes(".nittle.bak-") && !name.includes("diffle"))).toBe(true);
  });

  test("NITTLE_INSTALL_DIR wins and DIFFLE_INSTALL_DIR is the fallback", async () => {
    const box = open();
    const a = join(box.home, "a");
    const b = join(box.home, "b");
    await box.run([], { NITTLE_INSTALL_DIR: a, DIFFLE_INSTALL_DIR: b, NITTLE_NO_MODIFY_PATH: "1" });
    expect(existsSync(join(a, "nittle"))).toBe(true);
    expect(existsSync(join(b, "nittle"))).toBe(false);
    await box.run([], { DIFFLE_INSTALL_DIR: b, DIFFLE_NO_MODIFY_PATH: "1" });
    expect(existsSync(join(b, "nittle"))).toBe(true);
    expect(existsSync(join(box.home, ".zshrc"))).toBe(false);
  });

  test("each DIFFLE_* fallback in use prints one notice naming its NITTLE_* replacement", async () => {
    const box = open();
    const b = join(box.home, "b");
    const used = await box.run([], { DIFFLE_INSTALL_DIR: b, DIFFLE_NO_MODIFY_PATH: "1" });
    expect(used.out.match(/DIFFLE_INSTALL_DIR is deprecated.*set NITTLE_INSTALL_DIR instead/g)?.length).toBe(1);
    expect(used.out.match(/DIFFLE_NO_MODIFY_PATH is deprecated.*set NITTLE_NO_MODIFY_PATH instead/g)?.length).toBe(1);
    expect(used.out).not.toContain("DIFFLE_DRY_RUN");
    const shadowed = await box.run([], { NITTLE_INSTALL_DIR: b, DIFFLE_INSTALL_DIR: b, NITTLE_NO_MODIFY_PATH: "1" });
    expect(shadowed.out).not.toContain("is deprecated");
  });

  test("a dry run writes nothing", async () => {
    const box = open();
    const result = await box.run([], { NITTLE_DRY_RUN: "1" });
    expect(result.code).toBe(0);
    expect(existsSync(join(box.home, ".nittle"))).toBe(false);
    expect(existsSync(join(box.home, ".zshrc"))).toBe(false);
  });

  test("an existing diffle install triggers one `nittle --version`, nothing else in shell", async () => {
    const box = open();
    write(join(box.home, ".diffle", "bin", "diffle"), "old");
    write(join(box.home, ".zshrc"), `alias a=b\n${OLD_BLOCK(join(box.home, ".diffle", "bin"))}`);
    const result = await box.run();
    expect(result.code).toBe(0);
    expect(result.out).toContain("existing diffle install");
    expect(read(box.log).trim().split("\n")).toEqual(["--version"]);
    // the binary owns the migration: the installer did not touch the diffle binary or its block
    expect(existsSync(join(box.home, ".diffle", "bin", "diffle"))).toBe(true);
  });

  test("a custom-dir diffle install is found from the old installer's marker block and handed to the binary", async () => {
    const box = open();
    const custom = join(box.home, "tools", "diffle-bin");
    write(join(custom, "diffle"), "old");
    write(join(box.home, ".zshrc"), `alias a=b\n${OLD_BLOCK(custom)}`);
    const result = await box.run();
    expect(result.code).toBe(0);
    expect(norm(read(`${box.log}.legacy`).trim())).toBe(norm(custom));
  });

  test("a custom-dir diffle install is found from PATH, but system dirs are not", async () => {
    const box = open();
    const custom = join(box.home, "tools", "on-path");
    write(join(custom, "diffle"), "old");
    const result = await box.run([], { EXTRA_PATH: custom });
    expect(result.code).toBe(0);
    expect(read(`${box.log}.legacy`).trim().endsWith("tools/on-path")).toBe(true);
    box.cleanup();
    const plain = open();
    await plain.run();
    expect(existsSync(`${plain.log}.legacy`)).toBe(false);
  });

  test("--uninstall removes a custom-dir diffle install it discovered", async () => {
    const box = open();
    const custom = join(box.home, "tools", "diffle-bin");
    write(join(custom, "diffle"), "old");
    write(join(box.home, ".zshrc"), OLD_BLOCK(custom));
    const result = await box.run(["--uninstall"]);
    expect(result.code).toBe(0);
    expect(existsSync(join(custom, "diffle"))).toBe(false);
    expect(read(join(box.home, ".zshrc")).trim()).toBe("");
  });

  test("a dry run with a diffle install does not run the binary", async () => {
    const box = open();
    write(join(box.home, ".diffle", "bin", "diffle"), "old");
    await box.run([], { NITTLE_DRY_RUN: "1" });
    expect(read(box.log)).toBe("");
  });

  test("a checksum mismatch installs nothing", async () => {
    const box = open({ badChecksum: true });
    const result = await box.run();
    expect(result.code).not.toBe(0);
    expect(result.out).toContain("checksum mismatch");
    expect(existsSync(join(box.home, ".nittle", "bin", "nittle"))).toBe(false);
  });

  test("a release without the nittle asset says so", async () => {
    const box = open({ assets: ["diffle-linux-x64", "checksums.txt"] });
    const result = await box.run();
    expect(result.code).not.toBe(0);
    expect(result.out).toContain(`missing required asset: ${ASSET}`);
  });
});

describe.skipIf(!sh)("install.sh --uninstall", () => {
  test("removes nittle and every diffle leftover but keeps non-empty data", async () => {
    const box = open();
    await box.run();
    write(join(box.home, ".diffle", "bin", "diffle"), "old");
    write(join(box.home, ".diffle", "bin", ".diffle.new-1"), "staged");
    write(join(box.home, ".bashrc"), `keep me\n${OLD_BLOCK("/x/.diffle/bin")}`);
    write(join(box.home, ".nittle", "state.json"), "{}");
    const rcBefore = read(join(box.home, ".zshrc"));
    expect(rcBefore).toContain("# >>> nittle >>>");

    const result = await box.run(["--uninstall"]);
    expect(result.code).toBe(0);
    expect(existsSync(join(box.home, ".nittle", "bin"))).toBe(false);
    expect(existsSync(join(box.home, ".diffle"))).toBe(false);
    expect(read(join(box.home, ".zshrc"))).not.toContain("nittle");
    expect(read(join(box.home, ".bashrc"))).toBe("keep me\n");
    expect(read(join(box.home, ".nittle", "state.json"))).toBe("{}");
  });

  test("removes an empty data dir and honours the DIFFLE_UNINSTALL fallback", async () => {
    const box = open();
    await box.run();
    const result = await box.run([], { DIFFLE_UNINSTALL: "1" });
    expect(result.code).toBe(0);
    expect(existsSync(join(box.home, ".nittle"))).toBe(false);
  });

  test("only staging leftovers go: .diffle-notes and .nittle.settings survive", async () => {
    const box = open();
    await box.run();
    write(join(box.home, ".diffle", "bin", "diffle"), "old");
    write(join(box.home, ".diffle", "bin", ".diffle-notes"), "mine");
    write(join(box.home, ".diffle", "bin", ".diffle.new-1"), "staged");
    write(join(box.home, ".nittle", "bin", ".nittle.settings"), "mine");
    await box.run(["--uninstall"]);
    expect(readdirSync(join(box.home, ".diffle", "bin"))).toEqual([".diffle-notes"]);
    expect(readdirSync(join(box.home, ".nittle", "bin"))).toEqual([".nittle.settings"]);
  });

  test("a dry run removes nothing", async () => {
    const box = open();
    await box.run();
    await box.run(["--uninstall"], { NITTLE_DRY_RUN: "1" });
    expect(existsSync(join(box.home, ".nittle", "bin", "nittle"))).toBe(true);
  });
});
