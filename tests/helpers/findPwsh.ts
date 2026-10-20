import { lstatSync } from "node:fs";
import { join } from "node:path";

// stat follows the alias and fails, so lstat it
const isThere = (path: string) => {
  try { return lstatSync(path) !== undefined; } catch { return false; }
};

// pwsh from the store is an app-execution alias that Bun.which cannot resolve, so also probe the
// alias folder and the msi install dir. null means no PowerShell 7 here.
export function findPwsh(): string | null {
  const onPath = Bun.which("pwsh");
  if (onPath) return onPath;
  if (process.platform !== "win32") return null;
  const candidates = [
    join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WindowsApps", "pwsh.exe"),
    join(process.env.ProgramFiles ?? "C:\\Program Files", "PowerShell", "7", "pwsh.exe"),
  ];
  return candidates.find(isThere) ?? null;
}

