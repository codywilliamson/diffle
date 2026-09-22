import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { binary, checksum, cleanupTempDirs, root, run, tempDir } from "./helpers/installers";

function resolveShell(name: string): string | null {
  const fallback = `C:\\Program Files\\Git\\usr\\bin\\${name}.exe`;
  return Bun.which(name) ?? (existsSync(fallback) ? fallback : null);
}

// the installer must stay POSIX, so every scenario runs under dash as well as sh when both exist
const shells = ["sh", "dash"]
  .map((name) => [name, resolveShell(name)] as [string, string | null])
  .filter((entry): entry is [string, string] => entry[1] !== null);

afterEach(cleanupTempDirs);

function toShPath(path: string): string {
  return path.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replaceAll("\\", "/");
}

const sq = (value: string) => value.replaceAll("'", "'\\''");

interface WrapperOptions {
  scenario?: "missing" | "success" | "checksum";
  loginShell?: string;
  unameOs?: "Linux" | "Darwin";
  /** values may use the {HOME} and {BIN} tokens */
  env?: Record<string, string>;
  pathPrefix?: string;
  /** run the installer as a file with these args instead of sourcing it */
  args?: string[];
  reuse?: Sandbox;
}

interface Sandbox {
  dir: string;
  home: string;
  binDir: string;
  bin: string;
  wrapper: string;
}

/** a sandboxed wrapper: mocked uname/curl, a throwaway HOME, and a temp install dir */
function sandbox(shellPath: string, options: WrapperOptions = {}): Sandbox {
  const { scenario = "success", loginShell = "/bin/sh", unameOs = "Linux", env = {}, pathPrefix, args, reuse } = options;
  const dir = tempDir();
  const home = reuse?.home ?? join(dir, "home");
  const binDir = reuse?.binDir ?? join(dir, "bin");
  mkdirSync(home, { recursive: true });
  const bin = toShPath(binDir);
  const expand = (value: string) => value.replaceAll("{HOME}", toShPath(home)).replaceAll("{BIN}", bin);

  const asset = `diffle-${unameOs === "Darwin" ? "darwin" : "linux"}-x64`;
  const releaseAssets = scenario === "missing" ? '    "name": "loupe.exe"' : `    "name": "${asset}"\n    "name": "checksums.txt"`;
  const publishedChecksum = scenario === "checksum" ? "0".repeat(64) : checksum;
  const exports = Object.entries(env).map(([key, value]) => `export ${key}='${sq(expand(value))}'`).join("\n");
  // git's autocrlf can hand a Windows checkout a CRLF install.sh, which dash refuses to parse
  const installerCopy = join(dir, "install.sh");
  writeFileSync(installerCopy, readFileSync(join(root, "install.sh"), "utf8").replaceAll("\r\n", "\n"));
  const installer = toShPath(installerCopy);
  const invoke = args
    ? `'${sq(toShPath(shellPath))}' '${installer}' ${args.map((arg) => `'${sq(arg)}'`).join(" ")}`
    : `. '${installer}'`;

  const wrapper = join(dir, "wrapper.sh");
  writeFileSync(wrapper, `#!/bin/sh
PATH="${pathPrefix ? `${sq(expand(pathPrefix))}:` : ""}/usr/bin:/bin:$PATH"; export PATH
HOME='${toShPath(home)}'; export HOME
SHELL='${sq(loginShell)}'; export SHELL
unset ZDOTDIR XDG_CONFIG_HOME NO_COLOR DIFFLE_NO_MODIFY_PATH DIFFLE_DRY_RUN DIFFLE_UNINSTALL
uname() { [ "$1" = "-s" ] && echo ${unameOs} || echo x86_64; }
curl() {
  out=""; url=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -o) out="$2"; shift 2 ;;
      http*) url="$1"; shift ;;
      *) shift ;;
    esac
  done
  case "$url" in
    */releases/latest) printf '%s\n' '{' '  "tag_name": "v0.17.0",' '  "assets": [' '${releaseAssets}' '  ]' '}' > "$out" ;;
    */checksums.txt) printf '%s  %s\n' '${publishedChecksum}' '${asset}' > "$out" ;;
    */${asset}) printf '${sq(binary)}' > "$out" ;;
    *) return 22 ;;
  esac
}
export DIFFLE_INSTALL_DIR='${bin}'
${exports}
${invoke}
`);
  return { dir, home, binDir, bin, wrapper };
}

const pathBlock = (bin: string) => `\n# >>> diffle >>>\nexport PATH="${bin}:$PATH"\n# <<< diffle <<<\n`;
const sourceBlock = '\n# >>> diffle >>>\n[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"\n# <<< diffle <<<\n';
const backups = (home: string, rc: string) => readdirSync(home).filter((name) => name.startsWith(`${rc}.diffle.bak-`));

for (const [shellName, shellPath] of shells) {
  describe(`install.sh (${shellName})`, () => {
    const exec = (box: Sandbox) => run(shellPath, [box.wrapper], box.dir);

    it("reports a concise error before downloading when the latest release has no diffle assets", async () => {
      const box = sandbox(shellPath, { scenario: "missing" });
      const result = await exec(box);
      expect(result.code).toBe(1);
      expect(result.stderr.trim()).toBe(
        "diffle install: latest release v0.17.0 is missing required asset: diffle-linux-x64; no compatible diffle release is available yet",
      );
      expect(existsSync(join(box.binDir, "diffle"))).toBe(false);
    });

    it("verifies and atomically installs the matching asset, logging plain leveled lines when piped", async () => {
      const box = sandbox(shellPath);
      const result = await exec(box);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("installed diffle v0.17.0");
      expect(result.stdout).toMatch(/\[\d\d:\d\d:\d\d\] \[OK\] /);
      expect(result.stdout).toContain("[WAIT] downloading diffle-linux-x64 (v0.17.0)");
      expect(result.stdout).not.toContain("\u001b");
      expect(result.stdout).not.toContain("\r");
      expect(result.stderr.trim()).toBe("");
      expect(readFileSync(join(box.binDir, "diffle"), "utf8")).toBe(binary);
    });

    it("keeps an existing install when checksum verification fails", async () => {
      const box = sandbox(shellPath, { scenario: "checksum" });
      mkdirSync(box.binDir, { recursive: true });
      writeFileSync(join(box.binDir, "diffle"), "existing");
      const result = await exec(box);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("checksum mismatch for diffle-linux-x64");
      expect(readFileSync(join(box.binDir, "diffle"), "utf8")).toBe("existing");
    });

    it("appends the marker block to .zshrc once and reports no change on re-run", async () => {
      const box = sandbox(shellPath, { loginShell: "/usr/bin/zsh" });
      const rc = join(box.home, ".zshrc");
      const first = await exec(box);
      expect(first.code).toBe(0);
      expect(readFileSync(rc, "utf8")).toBe(pathBlock(box.bin));
      expect(first.stdout).toContain("activate now:  exec $SHELL -l");

      const second = await exec(box);
      expect(second.code).toBe(0);
      expect(second.stdout).toContain("already configured in");
      expect(readFileSync(rc, "utf8")).toBe(pathBlock(box.bin));
    });

    it("honors ZDOTDIR for zsh", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/zsh", env: { ZDOTDIR: "{HOME}/zdot" } });
      const result = await exec(box);
      expect(result.code).toBe(0);
      expect(existsSync(join(box.home, ".zshrc"))).toBe(false);
      expect(readFileSync(join(box.home, "zdot", ".zshrc"), "utf8")).toBe(pathBlock(box.bin));
    });

    it("uses .bashrc on Linux and leaves .bash_profile alone", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/bash" });
      const result = await exec(box);
      expect(result.code).toBe(0);
      expect(readFileSync(join(box.home, ".bashrc"), "utf8")).toBe(pathBlock(box.bin));
      expect(existsSync(join(box.home, ".bash_profile"))).toBe(false);
    });

    it("also makes .bash_profile source .bashrc on Darwin, idempotently", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/bash", unameOs: "Darwin" });
      const first = await exec(box);
      expect(first.code).toBe(0);
      expect(readFileSync(join(box.home, ".bash_profile"), "utf8")).toBe(sourceBlock);
      expect(readFileSync(join(box.home, ".bashrc"), "utf8")).toBe(pathBlock(box.bin));

      const second = await exec(box);
      expect(second.code).toBe(0);
      expect(second.stdout).toContain("already sources .bashrc; no change");
      expect(readFileSync(join(box.home, ".bash_profile"), "utf8")).toBe(sourceBlock);
    });

    it("writes fish syntax into config.fish", async () => {
      const box = sandbox(shellPath, { loginShell: "/usr/local/bin/fish" });
      const result = await exec(box);
      expect(result.code).toBe(0);
      const rc = join(box.home, ".config", "fish", "config.fish");
      expect(readFileSync(rc, "utf8")).toBe(`\n# >>> diffle >>>\nfish_add_path "${box.bin}"\n# <<< diffle <<<\n`);
      expect(result.stdout).toContain(`activate now:  source ${toShPath(rc)}`);
    });

    it("falls back to .profile for an unrecognised login shell", async () => {
      const box = sandbox(shellPath, { loginShell: "/opt/ksh" });
      const result = await exec(box);
      expect(result.code).toBe(0);
      expect(readFileSync(join(box.home, ".profile"), "utf8")).toBe(pathBlock(box.bin));
    });

    it("leaves existing rc contents byte-identical and backs the file up on the first edit only", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/zsh" });
      const rc = join(box.home, ".zshrc");
      const original = 'export FOO=1\n\nalias ll="ls -l"\n';
      writeFileSync(rc, original);
      await exec(box);
      expect(readFileSync(rc, "utf8")).toBe(original + pathBlock(box.bin));
      expect(backups(box.home, ".zshrc")).toHaveLength(1);
      expect(readFileSync(join(box.home, backups(box.home, ".zshrc")[0]!), "utf8")).toBe(original);

      await exec(box);
      expect(backups(box.home, ".zshrc")).toHaveLength(1);
    });

    it("skips every rc edit under DIFFLE_NO_MODIFY_PATH and prints the manual line", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/zsh", env: { DIFFLE_NO_MODIFY_PATH: "1" } });
      const result = await exec(box);
      expect(result.code).toBe(0);
      expect(existsSync(join(box.home, ".zshrc"))).toBe(false);
      expect(result.stdout).toContain(`add it to your PATH:  export PATH="${box.bin}:$PATH"`);
      expect(existsSync(join(box.binDir, "diffle"))).toBe(true);
    });

    it("writes nothing under DIFFLE_DRY_RUN", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/zsh", env: { DIFFLE_DRY_RUN: "1" } });
      const result = await exec(box);
      expect(result.code).toBe(0);
      expect(existsSync(join(box.binDir, "diffle"))).toBe(false);
      expect(existsSync(join(box.home, ".zshrc"))).toBe(false);
      expect(result.stdout).toContain("dry run: would install diffle v0.17.0");
      expect(result.stdout).toContain("dry run: would append the diffle PATH block");
    });

    it("makes no rc change when the install dir is already on PATH", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/zsh", pathPrefix: "{BIN}" });
      const result = await exec(box);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("already on PATH; no change");
      expect(existsSync(join(box.home, ".zshrc"))).toBe(false);
    });

    it("removes only the marker block and the binary on uninstall", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/zsh" });
      const rc = join(box.home, ".zshrc");
      const original = 'export FOO=1\n\nalias ll="ls -l"\n';
      writeFileSync(rc, original);
      await exec(box);
      expect(readFileSync(rc, "utf8")).not.toBe(original);

      const remove = sandbox(shellPath, { loginShell: "/bin/zsh", reuse: box, env: { DIFFLE_UNINSTALL: "1" } });
      const result = await exec(remove);
      expect(result.code).toBe(0);
      expect(readFileSync(rc, "utf8")).toBe(original);
      expect(existsSync(join(box.binDir, "diffle"))).toBe(false);
      expect(result.stdout).toContain("uninstalled diffle");
    });

    it("supports --uninstall when the script is run as a file", async () => {
      const box = sandbox(shellPath, { loginShell: "/bin/bash" });
      const rc = join(box.home, ".bashrc");
      await exec(box);
      expect(readFileSync(rc, "utf8")).toBe(pathBlock(box.bin));

      const remove = sandbox(shellPath, { loginShell: "/bin/bash", reuse: box, args: ["--uninstall"] });
      const result = await exec(remove);
      expect(result.code).toBe(0);
      expect(readFileSync(rc, "utf8")).toBe("");
      expect(existsSync(join(box.binDir, "diffle"))).toBe(false);
    });
  });
}
