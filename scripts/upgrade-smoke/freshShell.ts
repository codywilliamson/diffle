// a new shell, as a user would open after the upgrade: it builds PATH from what the installer
// persisted (the rc file on unix, the user PATH on windows) and nothing from the shell that ran the
// update. unix: a login bash that sources ~/.bashrc (macos sources it through the .bash_profile shim
// the installer adds). windows: a new pwsh whose PATH is machine PATH + user PATH, where the user
// PATH comes from the scope file seam (the runner's registry is untouched) or, with --registry,
// from the real registry.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { run, WINDOWS, type Sandbox } from "./sandbox";

export interface ShellView { path: string; which: string; version: string; }

const UNIX_SCRIPT = `${process.platform === "darwin" ? "" : 'if [ -f "$HOME/.bashrc" ]; then . "$HOME/.bashrc"; fi\n'}echo "SMOKE_PATH=$PATH"
echo "SMOKE_WHICH=$(command -v nittle)"
echo "SMOKE_VERSION=$(nittle --version | head -n1)"`;

const WINDOWS_SCRIPT = `$ErrorActionPreference = 'Stop'
$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$user = if ($env:NITTLE_PATH_SCOPE_FILE) { [IO.File]::ReadAllText($env:NITTLE_PATH_SCOPE_FILE) } else { [Environment]::GetEnvironmentVariable('Path', 'User') }
$env:Path = [Environment]::ExpandEnvironmentVariables("$user;$machine")
Write-Output "SMOKE_PATH=$env:Path"
Write-Output "SMOKE_WHICH=$((Get-Command nittle -ErrorAction SilentlyContinue).Source)"
Write-Output "SMOKE_VERSION=$((nittle --version | Select-Object -First 1))"`;

const field = (output: string, name: string) => output.split(/\r?\n/).find((line) => line.startsWith(`SMOKE_${name}=`))?.slice(name.length + 7).trim() ?? "";

export function openFreshShell(box: Sandbox): ShellView {
  let result;
  if (WINDOWS) {
    const script = join(box.root, "fresh-shell.ps1");
    writeFileSync(script, WINDOWS_SCRIPT);
    result = run("pwsh", ["-NoProfile", "-File", script], box.env(), box.home);
  } else {
    result = run("bash", ["-lc", UNIX_SCRIPT], box.env({ PATH: box.cleanPath }), box.home);
  }
  return { path: field(result.stdout, "PATH"), which: field(result.stdout, "WHICH"), version: field(result.stdout, "VERSION") };
}
