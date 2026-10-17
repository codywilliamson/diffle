// finds an executable on PATH. Bun.which already walks PATHEXT on windows (.cmd/.exe), so this
// only adds explicit-path handling and an injectable PATH for tests.

import { existsSync, statSync } from "node:fs";

function isFile(path: string): boolean {
  try { return existsSync(path) && statSync(path).isFile(); } catch { return false; }
}

export function findExecutable(command: string, searchPath?: string): string | undefined {
  if (command.includes("/") || command.includes("\\")) return isFile(command) ? command : undefined;
  return Bun.which(command, searchPath === undefined ? {} : { PATH: searchPath }) ?? undefined;
}
