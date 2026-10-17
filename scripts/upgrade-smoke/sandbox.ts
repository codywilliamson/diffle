// the throwaway machine the upgrade smoke runs in: a temp root holding a fake home, a private temp
// dir and (on windows) a file standing in for the user PATH. every child process gets this
// environment, so nothing under the real home, registry or agent configs is read or written
// (except with --registry, meant for disposable ci runners).

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

export const WINDOWS = process.platform === "win32";
export const EXE = WINDOWS ? ".exe" : "";

export interface Sandbox {
  root: string;
  home: string;
  scopeFile: string | null; // windows user PATH stand-in; null = the real registry
  cleanPath: string; // PATH of the parent shell, before anything got installed
  env(extra?: Record<string, string>): Record<string, string>;
  cleanup(): void;
}

export function createSandbox(useRegistry: boolean): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "nittle-upgrade-smoke-"));
  const home = join(root, "home");
  const temp = join(root, "tmp");
  mkdirSync(home);
  mkdirSync(temp);
  const scopeFile = WINDOWS && !useRegistry ? join(root, "user-path.txt") : null;
  // a developer shell may already have a real diffle or nittle install on PATH; the sandbox must not see it
  const entries = (process.env.PATH ?? "").split(delimiter);
  const cleanPath = entries.filter((entry) => !/diffle|nittle/i.test(entry)).join(delimiter);
  if (cleanPath.length !== entries.join(delimiter).length) console.log("dropped diffle/nittle entries from the parent PATH");

  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !/^(DIFFLE|NITTLE|LOUPE)_|^path$/i.test(key) && key !== "ZDOTDIR") base[key] = value;
  }
  Object.assign(base, {
    PATH: cleanPath, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, ".config"), APPDATA: join(home, "AppData", "Roaming"),
    LOCALAPPDATA: join(home, "AppData", "Local"), CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex"),
    TEMP: temp, TMP: temp, TMPDIR: temp, SHELL: "/bin/bash",
  });
  return {
    root, home, scopeFile, cleanPath,
    env: (extra = {}) => ({
      ...base,
      ...(scopeFile ? { DIFFLE_PATH_SCOPE_FILE: scopeFile, NITTLE_PATH_SCOPE_FILE: scopeFile } : {}),
      ...extra,
    }),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export interface RunResult { code: number; stdout: string; stderr: string; }

export function run(command: string, args: string[], env: Record<string, string>, cwd: string): RunResult {
  const result = Bun.spawnSync([command, ...args], { env, cwd, stdout: "pipe", stderr: "pipe" });
  const out = { code: result.exitCode ?? -1, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  process.stdout.write(`$ ${command} ${args.join(" ").slice(0, 160)}\n${out.stdout}${out.stderr}`);
  return out;
}

export const pathWith = (dir: string, base: string) => `${dir}${delimiter}${base}`;
