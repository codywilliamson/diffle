// an activated python virtualenv: its bin dir holds the user's own language server and the
// interpreter that sees the project's site-packages. VIRTUAL_ENV comes from the user's shell,
// so its bin dir is searched even when it sits inside the repository (.venv).

import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export interface VirtualEnv { bin: string; env: Record<string, string> }

export function activeVirtualEnv(environment: NodeJS.ProcessEnv = process.env): VirtualEnv | undefined {
  const root = environment.VIRTUAL_ENV;
  if (!root) return undefined;
  const bin = join(root, process.platform === "win32" ? "Scripts" : "bin");
  if (!existsSync(bin)) return undefined;
  const path = environment.PATH ?? environment.Path ?? "";
  return { bin, env: { VIRTUAL_ENV: root, PATH: path ? `${bin}${delimiter}${path}` : bin } };
}
