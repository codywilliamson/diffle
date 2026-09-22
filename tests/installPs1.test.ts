import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { binary, checksum, cleanupTempDirs, root, run, tempDir } from "./helpers/installers";

const pwsh = Bun.which("pwsh") ?? Bun.which("powershell");

afterEach(cleanupTempDirs);

function psPath(path: string): string {
  return path.replaceAll("'", "''");
}

(pwsh ? describe : describe.skip)("install.ps1", () => {
  it("reports a concise error before downloading when the latest release has no diffle assets", async () => {
    const dir = tempDir();
    const wrapper = join(dir, "missing.ps1");
    writeFileSync(wrapper, `
$env:PROCESSOR_ARCHITECTURE = 'AMD64'
$env:DIFFLE_INSTALL_DIR = '${psPath(join(dir, "bin"))}'
function Invoke-RestMethod { [pscustomobject]@{ tag_name = 'v0.15.2'; assets = @([pscustomobject]@{ name = 'loupe.exe' }) } }
function Invoke-WebRequest { throw 'download should not run' }
$BeforePreference = $ErrorActionPreference
$Failure = $null
try { Invoke-Expression (Get-Content -Raw -LiteralPath '${psPath(join(root, "install.ps1"))}') }
catch { $Failure = $_.Exception.Message }
if (-not $Failure) { exit 99 }
if ($ErrorActionPreference -ne $BeforePreference) { [Console]::Error.WriteLine('installer leaked ErrorActionPreference'); exit 43 }
if (Get-Command Save-ReleaseAsset -ErrorAction SilentlyContinue) { [Console]::Error.WriteLine('installer leaked helper function'); exit 44 }
[Console]::Error.WriteLine($Failure)
exit 42
`);

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(42);
    expect(result.stderr.trim()).toBe(
      "diffle install: latest release v0.15.2 is missing required asset(s): diffle-windows-x64.exe, checksums.txt; no compatible diffle release is available yet",
    );
    expect(result.stderr).not.toContain("github.githubassets.com");
    expect(existsSync(join(dir, "bin", "diffle.exe"))).toBe(false);
  });

  it("verifies and atomically installs the matching asset", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const wrapper = join(dir, "success.ps1");
    writeFileSync(wrapper, `
$env:PROCESSOR_ARCHITECTURE = 'AMD64'
$env:DIFFLE_INSTALL_DIR = '${psPath(bin)}'
function Invoke-RestMethod {
  [pscustomobject]@{ tag_name = 'v0.17.0'; assets = @(
    [pscustomobject]@{ name = 'diffle-windows-x64.exe'; browser_download_url = 'mock:binary' },
    [pscustomobject]@{ name = 'checksums.txt'; browser_download_url = 'mock:checksums' }
  ) }
}
function Invoke-WebRequest {
  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, $ErrorAction)
  if ($Uri -eq 'mock:binary') { [IO.File]::WriteAllText($OutFile, '${binary.replaceAll("'", "''")}') }
  else { [IO.File]::WriteAllText($OutFile, '${checksum}  diffle-windows-x64.exe' + [Environment]::NewLine) }
}
Invoke-Expression (Get-Content -Raw -LiteralPath '${psPath(join(root, "install.ps1"))}')
`);

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("installed diffle v0.17.0");
    expect(readFileSync(join(bin, "diffle.exe"), "utf8")).toBe(binary);
    expect(existsSync(bin) && readFileSync(join(bin, "diffle.exe")).length > 0).toBe(true);
  });

  it("keeps an existing install when checksum verification fails", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const target = join(bin, "diffle.exe");
    mkdirSync(bin, { recursive: true });
    writeFileSync(target, "existing");
    const wrapper = join(dir, "checksum.ps1");
    writeFileSync(wrapper, `
$env:PROCESSOR_ARCHITECTURE = 'AMD64'
$env:DIFFLE_INSTALL_DIR = '${psPath(bin)}'
function Invoke-RestMethod {
  [pscustomobject]@{ tag_name = 'v0.17.0'; assets = @(
    [pscustomobject]@{ name = 'diffle-windows-x64.exe'; browser_download_url = 'mock:binary' },
    [pscustomobject]@{ name = 'checksums.txt'; browser_download_url = 'mock:checksums' }
  ) }
}
function Invoke-WebRequest {
  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, $ErrorAction)
  if ($Uri -eq 'mock:binary') { [IO.File]::WriteAllText($OutFile, 'corrupt') }
  else { [IO.File]::WriteAllText($OutFile, '${"0".repeat(64)}  diffle-windows-x64.exe' + [Environment]::NewLine) }
}
try { Invoke-Expression (Get-Content -Raw -LiteralPath '${psPath(join(root, "install.ps1"))}'); exit 99 }
catch { [Console]::Error.WriteLine($_.Exception.Message); exit 42 }
`);

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(42);
    expect(result.stderr).toContain("checksum mismatch for diffle-windows-x64.exe");
    expect(readFileSync(target, "utf8")).toBe("existing");
  });
});
