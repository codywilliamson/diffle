import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const binary = "verified diffle binary\n";
const checksum = createHash("sha256").update(binary).digest("hex");
const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "diffle-installer-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function run(command: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn([command, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

const pwsh = Bun.which("pwsh") ?? Bun.which("powershell");
const gitSh = Bun.which("sh") ?? (existsSync("C:\\Program Files\\Git\\usr\\bin\\sh.exe") ? "C:\\Program Files\\Git\\usr\\bin\\sh.exe" : null);

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

function shWrapper(dir: string, scenario: "missing" | "success" | "checksum"): string {
  const toShPath = (path: string) => path.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replaceAll("\\", "/");
  const bin = toShPath(join(dir, "bin"));
  const installer = toShPath(join(root, "install.sh"));
  const wrapper = join(dir, `${scenario}.sh`);
  const releaseAssets = scenario === "missing"
    ? '    "name": "loupe.exe"'
    : '    "name": "diffle-linux-x64"\n    "name": "checksums.txt"';
  const publishedChecksum = scenario === "checksum" ? "0".repeat(64) : checksum;
  writeFileSync(wrapper, `#!/bin/sh
PATH="/usr/bin:/bin:$PATH"; export PATH
uname() { [ "$1" = "-s" ] && echo Linux || echo x86_64; }
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
    */checksums.txt) printf '%s  %s\n' '${publishedChecksum}' 'diffle-linux-x64' > "$out" ;;
    */diffle-linux-x64) printf '${binary.replaceAll("'", "'\\''")}' > "$out" ;;
    *) return 22 ;;
  esac
}
export DIFFLE_INSTALL_DIR='${bin}'
. '${installer}'
`);
  return wrapper;
}

(gitSh ? describe : describe.skip)("install.sh", () => {
  it("reports a concise error before downloading when the latest release has no diffle assets", async () => {
    const dir = tempDir();
    const result = await run(gitSh!, [shWrapper(dir, "missing")], dir);
    expect(result.code).toBe(1);
    expect(result.stderr.trim()).toBe(
      "diffle install: latest release v0.17.0 is missing required asset: diffle-linux-x64; no compatible diffle release is available yet",
    );
    expect(existsSync(join(dir, "bin", "diffle"))).toBe(false);
  });

  it("verifies and atomically installs the matching asset", async () => {
    const dir = tempDir();
    const result = await run(gitSh!, [shWrapper(dir, "success")], dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("installed diffle v0.17.0");
    expect(readFileSync(join(dir, "bin", "diffle"), "utf8")).toBe(binary);
  });

  it("keeps an existing install when checksum verification fails", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "diffle"), "existing");
    const result = await run(gitSh!, [shWrapper(dir, "checksum")], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("checksum mismatch for diffle-linux-x64");
    expect(readFileSync(join(bin, "diffle"), "utf8")).toBe("existing");
  });
});
