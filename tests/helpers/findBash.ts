// a bash that can read windows paths. on windows `bash` on PATH is often the WSL launcher
// (system32\bash.exe or the WindowsApps alias): it hands the script path to a linux shell that
// cannot see C:\ and mangles the backslashes, so it must never be picked. git for windows bash can.

import { existsSync } from "node:fs";
import { join } from "node:path";

const WSL_LAUNCHER = /[\\/](windows[\\/]system32|windowsapps)[\\/]/i;
const GIT_BASH_SUBPATH = join("Git", "bin", "bash.exe");

function gitForWindowsBash(): string | undefined {
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs")];
  return roots.filter((root): root is string => Boolean(root)).map((root) => join(root, GIT_BASH_SUBPATH)).find(existsSync);
}

export function findBash(): string | undefined {
  const onPath = Bun.which("bash");
  if (process.platform !== "win32") return onPath ?? undefined;
  if (onPath && !WSL_LAUNCHER.test(onPath)) return onPath;
  return gitForWindowsBash();
}
