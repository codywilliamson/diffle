import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

describe.skipIf(!sh)("install.sh completions offer", () => {
  const ZSH_LINE = "command -v nittle >/dev/null 2>&1 && source <(nittle completion --shell zsh)";
  const answer = (box: InstallSandbox, text: string) => { const file = join(box.home, "answer"); write(file, text); return { NITTLE_TEST_TTY: file }; };

  test("yes adds the line inside the nittle marker block, before the end marker", async () => {
    const box = open();
    const result = await box.run([], answer(box, "y\n"));
    expect(result.code).toBe(0);
    const rc = read(join(box.home, ".zshrc"));
    expect(rc).toContain(`${ZSH_LINE}\n# <<< nittle <<<`);
    expect(rc.indexOf("# >>> nittle >>>")).toBeLessThan(rc.indexOf(ZSH_LINE));
    expect(rc.split("completion --shell").length).toBe(2);
  });

  test("the default answer adds nothing", async () => {
    const box = open();
    const result = await box.run([], answer(box, "\n"));
    expect(result.code).toBe(0);
    expect(read(join(box.home, ".zshrc"))).not.toContain("completion");
  });

  test("an explicit no adds nothing", async () => {
    const box = open();
    await box.run([], answer(box, "n\n"));
    expect(read(join(box.home, ".zshrc"))).not.toContain("completion");
  });

  test("NITTLE_NO_COMPLETIONS skips the prompt", async () => {
    const box = open();
    const result = await box.run([], { ...answer(box, "y\n"), NITTLE_NO_COMPLETIONS: "1" });
    expect(result.out).not.toContain("completions for");
    expect(read(join(box.home, ".zshrc"))).not.toContain("completion");
  });

  test("a non-interactive run skips the prompt and never runs the binary for it", async () => {
    const box = open();
    const result = await box.run();
    expect(result.out).not.toContain("completions for");
    expect(read(join(box.home, ".zshrc"))).not.toContain("completion");
    expect(read(box.log)).toBe("");
  });

  test("a dry run skips the prompt", async () => {
    const box = open();
    const result = await box.run([], { ...answer(box, "y\n"), NITTLE_DRY_RUN: "1" });
    expect(result.out).not.toContain("completions for");
  });

  test("rerunning does not duplicate the line", async () => {
    const box = open();
    await box.run([], answer(box, "y\n"));
    await box.run([], answer(box, "y\n"));
    const rc = read(join(box.home, ".zshrc"));
    expect(rc.split("completion --shell").length).toBe(2);
    expect(rc.split("# >>> nittle >>>").length).toBe(2);
  });

  test("bash gets the eval line in .bashrc", async () => {
    const box = open();
    await box.run([], { ...answer(box, "yes\n"), SHELL: "/bin/bash" });
    expect(read(join(box.home, ".bashrc"))).toContain('eval "$(nittle completion --shell bash)"\n# <<< nittle <<<');
  });

  test("fish writes the completions file and uninstall removes it", async () => {
    const box = open();
    await box.run([], { ...answer(box, "y\n"), SHELL: "/usr/bin/fish" });
    const file = join(box.home, ".config", "fish", "completions", "nittle.fish");
    expect(read(file)).toBe("# installed by nittle\n# fake fish completions\n");
    expect(read(join(box.home, ".config", "fish", "config.fish"))).not.toContain("completion");
    const gone = await box.run(["--uninstall"], { SHELL: "/usr/bin/fish" });
    expect(gone.code).toBe(0);
    expect(existsSync(file)).toBe(false);
  });

  test("a nittle.fish the user wrote is neither overwritten nor removed", async () => {
    const box = open();
    const file = join(box.home, ".config", "fish", "completions", "nittle.fish");
    write(file, "# mine\ncomplete -c nittle\n");
    const env = { SHELL: "/usr/bin/fish" };
    await box.run([], { ...answer(box, "y\n"), ...env });
    expect(read(file)).toBe("# mine\ncomplete -c nittle\n");
    await box.run(["--uninstall"], env);
    expect(read(file)).toBe("# mine\ncomplete -c nittle\n");
  });

  // ntfs has no posix modes, so this only means something off windows
  test.skipIf(process.platform === "win32")("a 600 rc stays 600 after the completion line is added and removed", async () => {
    const box = open();
    const rc = join(box.home, ".zshrc");
    write(rc, "alias a=b\n");
    chmodSync(rc, 0o600);
    await box.run([], answer(box, "y\n"));
    expect(statSync(rc).mode & 0o777).toBe(0o600);
    expect(read(rc)).toContain("completion --shell zsh");
    await box.run(["--uninstall"]);
    expect(statSync(rc).mode & 0o777).toBe(0o600);
  });

  test("without a nittle block in the rc the line is printed, never written", async () => {
    const box = open();
    const result = await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(result.out).toContain(ZSH_LINE);
    expect(existsSync(join(box.home, ".zshrc"))).toBe(false);
  });

  test("a closing marker alone, or in front of the opening one, authorizes no insert", async () => {
    const box = open();
    const only = "alias a=b\n# <<< nittle <<<\n";
    write(join(box.home, ".zshrc"), only);
    const result = await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toBe(only);
    expect(result.out).toContain(ZSH_LINE);
    const reversed = "# <<< nittle <<<\nx\n# >>> nittle >>>\n";
    write(join(box.home, ".zshrc"), reversed);
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toBe(reversed);
    const prefixed = "# >>> nittle >>>\nexport PATH=x\n# <<< nittle <<< extra\n";
    write(join(box.home, ".zshrc"), prefixed);
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toBe(prefixed);
  });

  test("a completion line outside the block does not count as already wired", async () => {
    const box = open();
    write(join(box.home, ".zshrc"), 'source <(nittle completion --shell zsh)\n# >>> nittle >>>\nexport PATH="x:$PATH"\n# <<< nittle <<<\n');
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toContain(`${ZSH_LINE}\n# <<< nittle <<<\n`);
  });

  test("a crlf rc keeps its line endings, takes the line, and uninstall still finds the block", async () => {
    const box = open();
    const crlf = '# keep\r\n\r\n# >>> nittle >>>\r\nexport PATH="x:$PATH"\r\n# <<< nittle <<<\r\n';
    write(join(box.home, ".zshrc"), crlf);
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toBe(`# keep\r\n\r\n# >>> nittle >>>\r\nexport PATH="x:$PATH"\r\n${ZSH_LINE}\r\n# <<< nittle <<<\r\n`);
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc")).split("completion --shell").length).toBe(2);
    await box.run(["--uninstall"]);
    expect(read(join(box.home, ".zshrc"))).toBe("# keep\r\n");
  });

  test("an rc whose last line has no newline keeps it that way", async () => {
    const box = open();
    const inner = '# >>> nittle >>>\nexport PATH="x:$PATH"\n# <<< nittle <<<\n';
    write(join(box.home, ".zshrc"), `${inner}alias z=1`);
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toBe(`# >>> nittle >>>\nexport PATH="x:$PATH"\n${ZSH_LINE}\n# <<< nittle <<<\nalias z=1`);
    write(join(box.home, ".zshrc"), inner.trimEnd());
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toBe(`# >>> nittle >>>\nexport PATH="x:$PATH"\n${ZSH_LINE}\n# <<< nittle <<<`);
  });

  test("a commented-out completion line inside the block does not count as wired", async () => {
    const box = open();
    write(join(box.home, ".zshrc"), '# >>> nittle >>>\n# nittle completion --shell zsh\n# <<< nittle <<<\n');
    await box.run([], { ...answer(box, "y\n"), NITTLE_NO_MODIFY_PATH: "1" });
    expect(read(join(box.home, ".zshrc"))).toBe(`# >>> nittle >>>\n# nittle completion --shell zsh\n${ZSH_LINE}\n# <<< nittle <<<\n`);
  });

  test("a probe that hangs is killed and completions are skipped", async () => {
    const box = open();
    const started = Date.now();
    const result = await box.run([], { ...answer(box, "y\n"), FAKE_COMPLETION_HANG: "1", NITTLE_TEST_PROBE_TIMEOUT: "1" });
    expect(result.code).toBe(0);
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(result.out).not.toContain("completions for");
    expect(read(join(box.home, ".zshrc"))).not.toContain("completion");
  });

  test("the test seams are ignored unless NITTLE_INSTALLER_TEST=1", async () => {
    const box = open();
    const result = await box.run([], { ...answer(box, "y\n"), NITTLE_INSTALLER_TEST: "" });
    expect(result.out).not.toContain("completions for");
    expect(read(join(box.home, ".zshrc"))).not.toContain("completion");
  });

  test("uninstall removes the block together with its completion line", async () => {
    const box = open();
    write(join(box.home, ".zshrc"), "alias a=b\n");
    await box.run([], answer(box, "y\n"));
    await box.run(["--uninstall"]);
    expect(read(join(box.home, ".zshrc"))).toBe("alias a=b\n");
  });
});
