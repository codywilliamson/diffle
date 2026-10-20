// an activated python virtualenv: its bin dir holds the user's own language server and the
// interpreter that sees the project's site-packages. VIRTUAL_ENV comes from the user's shell
// (the process environment at startup; compiled binaries do not load .env), so an executable
// whose real path is inside that bin dir is allowed even when the venv sits in the repository.

import { existsSync, realpathSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { canonicalPath, containsPath } from "../../utils/pathWithin";
import { findExecutable } from "./which";

export interface VirtualEnv { bin: string; env: Record<string, string> }

export function activeVirtualEnv(environment: NodeJS.ProcessEnv = process.env): VirtualEnv | undefined {
  const root = environment.VIRTUAL_ENV;
  if (!root) return undefined;
  const bin = join(root, process.platform === "win32" ? "Scripts" : "bin");
  if (!existsSync(bin)) return undefined;
  const path = environment.PATH ?? environment.Path ?? "";
  return { bin, env: { VIRTUAL_ENV: root, PATH: path ? `${bin}${delimiter}${path}` : bin } };
}

// the absolute real path of the command as found in the venv, or undefined (the server runs from a temp dir, so a relative path would not survive). a bare name is looked up in the bin dir; a
// path is taken as given. either way the real path must sit inside the bin dir, so a command
// pointing anywhere else (the checkout, a symlink out of the venv) gets no exemption.
export function findInVirtualEnv(command: string, venv: VirtualEnv): string | undefined {
  const path = findExecutable(command, { searchPath: venv.bin }).path;
  if (!path || !containsPath(canonicalPath(venv.bin), canonicalPath(path))) return undefined;
  return realpathSync.native(resolve(path));
}
