import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { migrateInstallDir, type InstallDirDeps } from "../src/core/migration/installDir";
import { swapBlocks } from "../src/core/migration/installDirRc";
import { swapPathEntry, type UserPathStore } from "../src/core/migration/installDirWinPath";

let home = "";
beforeEach(() => { home = mkdtempSync(join(tmpdir(), "install-dir-")); });
afterEach(() => rmSync(home, { recursive: true, force: true }));

const BINARY = "binary-bytes";
const OLD_BLOCK = (dir: string) => ["# >>> diffle >>>", `export PATH="${dir}:$PATH"`, "# <<< diffle <<<"];
const write = (path: string, text: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
const legacyBin = (platform: NodeJS.Platform = "linux") => join(home, ".diffle", "bin", platform === "win32" ? "diffle.exe" : "diffle");

function memoryStore(initial: string): UserPathStore & { value: string } {
  const store = { value: initial, read: () => store.value, write: (v: string) => { store.value = v; } };
  return store;
}

function setup(overrides: Partial<InstallDirDeps> = {}) {
  const logs: string[] = [];
  const stops: number[] = [];
  const deps: Partial<InstallDirDeps> = {
    home, platform: "linux", env: {}, execPath: legacyBin(), pathStore: memoryStore(""),
    stopServers: () => stops.push(1), log: (line) => logs.push(line), ...overrides,
  };
  return { logs, stops, run: () => migrateInstallDir(deps) };
}

const installLegacy = (platform: NodeJS.Platform = "linux") => { write(legacyBin(platform), BINARY); chmodSync(legacyBin(platform), 0o755); };

describe("install dir migration from the diffle binary", () => {
  test("copies itself to ~/.nittle/bin, swaps the rc block and removes ~/.diffle", () => {
    installLegacy();
    const rc = join(home, ".zshrc");
    const before = ["# my stuff", "alias ll='ls -l'", "", ...OLD_BLOCK(join(home, ".diffle", "bin")), ""].join("\n");
    write(rc, before);
    const { run, stops, logs } = setup();
    run();

    const installed = join(home, ".nittle", "bin", "nittle");
    expect(readFileSync(installed, "utf8")).toBe(BINARY);
    if (process.platform !== "win32") expect(statSync(installed).mode & 0o111).not.toBe(0);
    expect(existsSync(join(home, ".diffle"))).toBe(false);
    expect(stops).toEqual([1]);
    expect(readFileSync(rc, "utf8")).toBe(["# my stuff", "alias ll='ls -l'", "", "# >>> nittle >>>", `export PATH="${join(home, ".nittle", "bin")}:$PATH"`, "# <<< nittle <<<", ""].join("\n"));
    const backups = readdirSync(home).filter((name) => name.startsWith(".zshrc."));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^\.zshrc\.nittle\.bak-\d{8}-\d{6}$/);
    expect(readFileSync(join(home, backups[0]!), "utf8")).toBe(before);
    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs.every((line) => line.startsWith("[nittle]"))).toBe(true);
  });

  test("a second run does nothing", () => {
    installLegacy();
    write(join(home, ".bashrc"), OLD_BLOCK(join(home, ".diffle", "bin")).join("\n") + "\n");
    setup().run();
    const rcAfterFirst = readFileSync(join(home, ".bashrc"), "utf8");
    const again = setup({ execPath: join(home, ".nittle", "bin", "nittle") });
    expect(again.run()).toBe("");
    expect(again.logs).toEqual([]);
    expect(again.stops).toEqual([]);
    expect(readFileSync(join(home, ".bashrc"), "utf8")).toBe(rcAfterFirst);
  });

  test("keeps ~/.diffle while it holds anything but bin", () => {
    installLegacy();
    write(join(home, ".diffle", "state.json"), "{}");
    setup().run();
    expect(existsSync(join(home, ".diffle", "bin"))).toBe(false);
    expect(readFileSync(join(home, ".diffle", "state.json"), "utf8")).toBe("{}");
  });

  test("a hand-added PATH entry is not edited; one line says what to change", () => {
    installLegacy();
    const rc = join(home, ".zshrc");
    write(rc, `export PATH="${join(home, ".diffle", "bin")}:$PATH"\n`);
    const { run, logs } = setup();
    run();
    expect(readFileSync(rc, "utf8")).toBe(`export PATH="${join(home, ".diffle", "bin")}:$PATH"\n`);
    expect(readdirSync(home).filter((name) => name.includes(".bak-"))).toEqual([]);
    expect(logs.filter((line) => line.includes("replace"))).toHaveLength(1);
    expect(existsSync(join(home, ".nittle", "bin", "nittle"))).toBe(true);
  });

  test("NITTLE_NO_MODIFY_PATH leaves every profile alone", () => {
    installLegacy();
    const rc = join(home, ".zshrc");
    write(rc, OLD_BLOCK("x").join("\n"));
    setup({ env: { NITTLE_NO_MODIFY_PATH: "1" } }).run();
    expect(readFileSync(rc, "utf8")).toBe(OLD_BLOCK("x").join("\n"));
  });

  test("DIFFLE_INSTALL_DIR names the legacy dir and NITTLE_INSTALL_DIR the new one", () => {
    const custom = join(home, "tools", "old");
    const target = join(home, "tools", "new");
    write(join(custom, "diffle"), BINARY);
    setup({ env: { DIFFLE_INSTALL_DIR: custom, NITTLE_INSTALL_DIR: target }, execPath: join(custom, "diffle") }).run();
    expect(readFileSync(join(target, "nittle"), "utf8")).toBe(BINARY);
    expect(existsSync(custom)).toBe(false);
  });

  test("a failed copy keeps the diffle install and reports", () => {
    installLegacy();
    write(join(home, ".nittle"), "a file where the bin dir should go");
    const { run, logs } = setup();
    expect(() => run()).toThrow();
    expect(existsSync(legacyBin())).toBe(true);
    expect(logs).toEqual([]);
  });

  test("an already identical nittle binary is left alone", () => {
    installLegacy();
    write(join(home, ".nittle", "bin", "nittle"), BINARY);
    const { run, logs } = setup();
    run();
    expect(logs.some((line) => line.includes("already installed"))).toBe(true);
    expect(existsSync(join(home, ".diffle"))).toBe(false);
  });

  test("an older nittle binary is replaced by the one that is running", () => {
    installLegacy();
    write(join(home, ".nittle", "bin", "nittle"), "older");
    setup().run();
    expect(readFileSync(join(home, ".nittle", "bin", "nittle"), "utf8")).toBe(BINARY);
  });

  test("a diffle-named binary outside the diffle install dir is ignored", () => {
    installLegacy();
    const elsewhere = join(home, "downloads", "diffle-linux-x64");
    write(elsewhere, BINARY);
    const { run, logs } = setup({ execPath: elsewhere });
    expect(run()).toBe("");
    expect(logs).toEqual([]);
    expect(existsSync(legacyBin())).toBe(true);
  });
});

describe("install dir migration from a nittle binary", () => {
  const nittle = () => join(home, ".nittle", "bin", "nittle");

  test("removes diffle leftovers without copying itself", () => {
    write(nittle(), "newer");
    installLegacy();
    write(join(home, ".diffle", "bin", ".diffle.new-123"), "staged");
    const { run, stops } = setup({ execPath: nittle() });
    run();
    expect(existsSync(join(home, ".diffle"))).toBe(false);
    expect(readFileSync(nittle(), "utf8")).toBe("newer");
    expect(stops).toEqual([1]);
  });

  test("an empty or leftover-only diffle bin dir needs no process scan", () => {
    write(nittle(), "newer");
    write(join(home, ".diffle", "bin", ".diffle.exe.old"), "retired");
    const { run, stops } = setup({ execPath: nittle(), platform: "win32" });
    run();
    expect(stops).toEqual([]);
    expect(existsSync(join(home, ".diffle"))).toBe(false);
  });

  test("nothing to do is one existsSync", () => {
    write(nittle(), "newer");
    const { run, logs } = setup({ execPath: nittle() });
    expect(run()).toBe("");
    expect(logs).toEqual([]);
  });

  test("a nittle binary installed in the legacy dir keeps its own dir and PATH entry", () => {
    const dir = join(home, "shared");
    write(join(dir, "nittle"), "n");
    write(join(dir, "diffle"), "d");
    const rc = join(home, ".zshrc");
    write(rc, OLD_BLOCK(dir).join("\n"));
    setup({ env: { DIFFLE_INSTALL_DIR: dir }, execPath: join(dir, "nittle") }).run();
    expect(readdirSync(dir)).toEqual(["nittle"]);
    expect(readFileSync(rc, "utf8")).toBe(OLD_BLOCK(dir).join("\n"));
  });
});

describe("windows layout", () => {
  const legacyDir = () => join(home, ".diffle", "bin");

  test("the running exe is renamed aside and the user PATH entry swapped in place", () => {
    installLegacy("win32");
    const store = memoryStore(`C:\\Windows;${legacyDir()}\\;%USERPROFILE%\\bin`);
    const { run } = setup({ platform: "win32", execPath: legacyBin("win32"), pathStore: store });
    run();
    expect(readFileSync(join(home, ".nittle", "bin", "nittle.exe"), "utf8")).toBe(BINARY);
    expect(store.value).toBe(`C:\\Windows;${join(home, ".nittle", "bin")};%USERPROFILE%\\bin`);
    expect(existsSync(legacyBin("win32"))).toBe(false);
  });

  test.skipIf(process.platform !== "win32")("a locked exe is deferred and a later nittle run removes it", async () => {
    installLegacy("win32");
    const locked = legacyBin("win32");
    writeFileSync(locked, readFileSync(process.execPath));
    const holder = Bun.spawn([locked, "-e", "setTimeout(() => {}, 60000)"], { stdout: "ignore", stderr: "ignore" });
    try {
      await Bun.sleep(300);
      const first = setup({ platform: "win32", execPath: locked, pathStore: memoryStore("") });
      first.run();
      expect(existsSync(locked)).toBe(false);
      expect(readdirSync(dirname(locked))).toEqual([".diffle.exe.old"]);
      expect(first.logs.some((line) => line.includes("still in use"))).toBe(true);
      holder.kill();
      await holder.exited;
      const later = setup({ platform: "win32", execPath: join(home, ".nittle", "bin", "nittle.exe"), pathStore: memoryStore("") });
      later.run();
      expect(existsSync(join(home, ".diffle"))).toBe(false);
    } finally {
      holder.kill();
    }
  });
});

describe("swapPathEntry", () => {
  const old = "C:\\Users\\u\\.diffle\\bin";
  const next = "C:\\Users\\u\\.nittle\\bin";

  test("replaces in place, keeping every other entry byte for byte", () => {
    expect(swapPathEntry(`A;%SystemRoot%\\x;${old};B`, old, next)).toBe(`A;%SystemRoot%\\x;${next};B`);
  });

  test("matches case-insensitively and ignores a trailing slash", () => {
    expect(swapPathEntry(`${old.toUpperCase()}\\;B`, old, next)).toBe(`${next};B`);
  });

  test("never duplicates an existing nittle entry", () => {
    expect(swapPathEntry(`${next};A;${old}`, old, next)).toBe(`${next};A`);
    expect(swapPathEntry(`${old};A;${next};${old}`, old, next)).toBe(`A;${next}`);
  });

  test("returns null when there is no diffle entry", () => {
    expect(swapPathEntry("A;B", old, next)).toBeNull();
  });
});

describe("swapBlocks", () => {
  const legacy = "/h/.diffle/bin";
  const fresh = "/h/.nittle/bin";

  test("fish and posix bodies are rewritten with the new dir", () => {
    const fish = ["x", "", "# >>> diffle >>>", `fish_add_path "${legacy}"`, "# <<< diffle <<<"];
    expect(swapBlocks(fish, legacy, fresh)).toEqual(["x", "", "# >>> nittle >>>", `fish_add_path "${fresh}"`, "# <<< nittle <<<"]);
  });

  test("the bash_profile shim keeps its body", () => {
    const shim = ["# >>> diffle >>>", '[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"', "# <<< diffle <<<"];
    expect(swapBlocks(shim, legacy, fresh)).toEqual(["# >>> nittle >>>", '[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"', "# <<< nittle <<<"]);
  });

  test("an existing nittle block means the diffle block is dropped, not duplicated", () => {
    const lines = ["a", "", ...OLD_BLOCK(legacy), "", "# >>> nittle >>>", `export PATH="${fresh}:$PATH"`, "# <<< nittle <<<"];
    expect(swapBlocks(lines, legacy, fresh)).toEqual(["a", "", "# >>> nittle >>>", `export PATH="${fresh}:$PATH"`, "# <<< nittle <<<"]);
  });

  test("an unterminated block and unrelated text are left alone", () => {
    expect(swapBlocks(["# >>> diffle >>>", "export PATH=x"], legacy, fresh)).toBeNull();
    expect(swapBlocks(["# diffle", "export PATH=/h/.diffle/bin"], legacy, fresh)).toBeNull();
  });
});

describe("per-shell rc files", () => {
  const cases: [string, string[], Record<string, string>][] = [
    ["zsh", [".zshrc"], {}],
    ["bash", [".bashrc"], {}],
    ["posix profile", [".profile"], {}],
    ["fish", [".config", "fish", "config.fish"], {}],
    ["zdotdir zsh", ["zsh", ".zshrc"], { ZDOTDIR: "<home>/zsh" }],
  ];
  for (const [label, parts, env] of cases) {
    test(`rewrites the block the installer wrote for ${label}`, () => {
      installLegacy();
      const rc = join(home, ...parts);
      const dir = join(home, ".diffle", "bin");
      write(rc, `before\n\n# >>> diffle >>>\nexport PATH="${dir}:$PATH"\n# <<< diffle <<<\nafter\n`);
      const resolved = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v.replace("<home>", home)]));
      setup({ env: resolved }).run();
      expect(readFileSync(rc, "utf8")).toBe(`before\n\n# >>> nittle >>>\nexport PATH="${join(home, ".nittle", "bin")}:$PATH"\n# <<< nittle <<<\nafter\n`);
    });
  }

  test("rewrites the bash_profile shim too", () => {
    installLegacy();
    write(join(home, ".bash_profile"), '# >>> diffle >>>\n[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"\n# <<< diffle <<<\n');
    setup().run();
    expect(readFileSync(join(home, ".bash_profile"), "utf8")).toBe('# >>> nittle >>>\n[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"\n# <<< nittle <<<\n');
  });
});
