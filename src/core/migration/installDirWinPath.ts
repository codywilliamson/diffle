// windows PATH swap for the install-dir migration: the user PATH (HKCU\Environment) entry for the
// diffle bin dir becomes the nittle bin dir, in place, never duplicated. the registry is read raw
// (no %VAR% expansion) so entries we don't own survive byte for byte, and the change is broadcast
// like install.ps1 does. NITTLE_PATH_SCOPE_FILE (legacy DIFFLE_PATH_SCOPE_FILE) is the test seam:
// the "user PATH" lives in that file instead of the registry.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "../product";

export interface UserPathStore {
  read(): string;
  write(value: string): void;
}

const PATH_SEPARATOR = ";";
const REG_SUBKEY_ENV = "NITTLE_ENV_REG_SUBKEY"; // test seam: scratch key instead of HKCU\Environment

const REG_PRELUDE = `$sub = if ($env:${REG_SUBKEY_ENV}) { $env:${REG_SUBKEY_ENV} } else { 'Environment' }`;
const READ_SCRIPT = `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
${REG_PRELUDE}
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($sub, $false)
if ($key) { try { [Console]::Out.Write([string]$key.GetValue('PATH', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)) } finally { $key.Dispose() } }`;
const WRITE_SCRIPT = `${REG_PRELUDE}
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($sub, $true)
try {
  $kind = if ($key.GetValueNames() -contains 'PATH') { $key.GetValueKind('PATH') } else { [Microsoft.Win32.RegistryValueKind]::ExpandString }
  $key.SetValue('PATH', $env:NITTLE_PATH_VALUE, $kind)
} finally { $key.Dispose() }
if ($sub -ne 'Environment') { return }
Add-Type -Namespace Nittle -Name NativeMethods -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Auto)] public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out System.UIntPtr lpdwResult);'
$answer = [UIntPtr]::Zero
[void][Nittle.NativeMethods]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$answer)`;

function powershell(script: string, env: NodeJS.ProcessEnv): string {
  const run = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { env, encoding: "utf8", windowsHide: true });
  if (run.error || run.status !== 0) throw new Error(`powershell could not reach the user PATH (${run.error?.message ?? run.stderr.trim() ?? run.status})`);
  return run.stdout;
}

export function scopeFileStore(file: string): UserPathStore {
  return { read: () => (existsSync(file) ? readFileSync(file, "utf8") : ""), write: (value) => writeFileSync(file, value) };
}

export function registryStore(env: NodeJS.ProcessEnv = process.env): UserPathStore {
  return {
    read: () => powershell(READ_SCRIPT, env),
    write: (value) => void powershell(WRITE_SCRIPT, { ...env, NITTLE_PATH_VALUE: value }),
  };
}

export function defaultUserPathStore(env: NodeJS.ProcessEnv = process.env): UserPathStore {
  const file = env[`${PRODUCT.envPrefix}PATH_SCOPE_FILE`] ?? env[`${PRODUCT.legacyEnvPrefix}PATH_SCOPE_FILE`];
  return file ? scopeFileStore(file) : registryStore(env);
}

const sameEntry = (entry: string, dir: string) => entry.trim().replace(/[\\/]+$/, "").toLowerCase() === dir.replace(/[\\/]+$/, "").toLowerCase();

export const userPathHas = (store: UserPathStore, dir: string): boolean => store.read().split(PATH_SEPARATOR).some((entry) => sameEntry(entry, dir));

// the PATH with `legacyDir` replaced by `newDir` in place; a nittle entry already present wins
// and the legacy ones are just dropped. null when there is no legacy entry.
export function swapPathEntry(value: string, legacyDir: string, newDir: string): string | null {
  const entries = value.split(PATH_SEPARATOR);
  if (!entries.some((entry) => sameEntry(entry, legacyDir))) return null;
  let hasNew = entries.some((entry) => sameEntry(entry, newDir));
  const out: string[] = [];
  for (const entry of entries) {
    if (!sameEntry(entry, legacyDir)) out.push(entry);
    else if (!hasNew) {
      out.push(newDir);
      hasNew = true;
    }
  }
  return out.join(PATH_SEPARATOR);
}

// true when the user PATH was changed. the previous value goes to a temp file first, as install.ps1 does.
export function swapUserPath(store: UserPathStore, legacyDir: string, newDir: string, log: (line: string) => void, now = new Date()): boolean {
  const current = store.read();
  const next = swapPathEntry(current, legacyDir, newDir);
  if (next === null) return false;
  const backup = join(tmpdir(), `${PRODUCT.name}-userpath-${now.toISOString().replace(/\D/g, "").slice(0, 14)}.txt`);
  writeFileSync(backup, current);
  store.write(next);
  log(`PATH: replaced ${legacyDir} with ${newDir} in the user PATH (backup: ${backup})`);
  return true;
}
