import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { binary, checksum, cleanupTempDirs, root, run, tempDir } from "./helpers/installers";

// the installer requires PowerShell 7 — Windows PowerShell 5.1 is not a substitute
const pwsh = Bun.which("pwsh");

afterEach(cleanupTempDirs);

function psPath(path: string): string {
  return path.replaceAll("'", "''");
}

// every wrapper routes the "user PATH" through a temp file so no test can touch the real registry
function prelude(dir: string, bin: string, extra: Record<string, string> = {}): string {
  const vars: Record<string, string> = {
    PROCESSOR_ARCHITECTURE: "AMD64",
    DIFFLE_INSTALL_DIR: bin,
    DIFFLE_PATH_SCOPE_FILE: userPathFile(dir),
    ...extra,
  };
  return Object.entries(vars)
    .map(([key, value]) => `$env:${key} = '${psPath(value)}'`)
    .join("\n");
}

function userPathFile(dir: string): string {
  return join(dir, "userpath.txt");
}

const releaseMock = `
function Invoke-RestMethod {
  [pscustomobject]@{ tag_name = 'v0.17.0'; assets = @(
    [pscustomobject]@{ name = 'diffle-windows-x64.exe'; browser_download_url = 'mock:binary' },
    [pscustomobject]@{ name = 'checksums.txt'; browser_download_url = 'mock:checksums' }
  ) }
}
`;

function downloadMock(payload: string, published: string): string {
  return `
function Invoke-WebRequest {
  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, $ErrorAction)
  if ($Uri -eq 'mock:binary') { [IO.File]::WriteAllText($OutFile, '${payload.replaceAll("'", "''")}') }
  else { [IO.File]::WriteAllText($OutFile, '${published}  diffle-windows-x64.exe' + [Environment]::NewLine) }
}
`;
}

const invokeInstaller = `Invoke-Expression (Get-Content -Raw -LiteralPath '${psPath(join(root, "install.ps1"))}')`;

function writeWrapper(dir: string, name: string, body: string): string {
  const wrapper = join(dir, name);
  writeFileSync(wrapper, body);
  return wrapper;
}

(pwsh ? describe : describe.skip)("install.ps1", () => {
  it("reports a concise error before downloading when the latest release has no diffle assets", async () => {
    const dir = tempDir();
    const wrapper = writeWrapper(
      dir,
      "missing.ps1",
      `
${prelude(dir, join(dir, "bin"), { DIFFLE_NO_MODIFY_PATH: "1" })}
function Invoke-RestMethod { [pscustomobject]@{ tag_name = 'v0.15.2'; assets = @([pscustomobject]@{ name = 'loupe.exe' }) } }
function Invoke-WebRequest { throw 'download should not run' }
$BeforePreference = $ErrorActionPreference
$Failure = $null
try { ${invokeInstaller} }
catch { $Failure = $_.Exception.Message }
if (-not $Failure) { exit 99 }
if ($ErrorActionPreference -ne $BeforePreference) { [Console]::Error.WriteLine('installer leaked ErrorActionPreference'); exit 43 }
if (Get-Command Save-ReleaseAsset -ErrorAction SilentlyContinue) { [Console]::Error.WriteLine('installer leaked helper function'); exit 44 }
[Console]::Error.WriteLine($Failure)
exit 42
`,
    );

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
    const wrapper = writeWrapper(
      dir,
      "success.ps1",
      `
${prelude(dir, bin, { DIFFLE_NO_MODIFY_PATH: "1" })}
${releaseMock}
${downloadMock(binary, checksum)}
${invokeInstaller}
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("installed diffle v0.17.0");
    expect(readFileSync(join(bin, "diffle.exe"), "utf8")).toBe(binary);
    expect(existsSync(bin) && readFileSync(join(bin, "diffle.exe")).length > 0).toBe(true);
    expect(result.stdout).not.toContain("setx");
    // redirected output: single WAIT lines, never a rewritten spinner frame
    expect(result.stdout).toContain("[WAIT]");
    expect(result.stdout).not.toContain("\r[");
    expect(existsSync(userPathFile(dir))).toBe(false);
  });

  it("keeps an existing install when checksum verification fails", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const target = join(bin, "diffle.exe");
    mkdirSync(bin, { recursive: true });
    writeFileSync(target, "existing");
    const wrapper = writeWrapper(
      dir,
      "checksum.ps1",
      `
${prelude(dir, bin, { DIFFLE_NO_MODIFY_PATH: "1" })}
${releaseMock}
${downloadMock("corrupt", "0".repeat(64))}
try { ${invokeInstaller}; exit 99 }
catch { [Console]::Error.WriteLine($_.Exception.Message); exit 42 }
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(42);
    expect(result.stderr).toContain("checksum mismatch for diffle-windows-x64.exe");
    expect(readFileSync(target, "utf8")).toBe("existing");
  });

  it("prepends the bin dir to the user PATH once and treats a re-run as a no-op", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const before = "C:\\Windows\\system32;C:\\existing tools";
    writeFileSync(userPathFile(dir), before);
    const wrapper = writeWrapper(
      dir,
      "path.ps1",
      `
${prelude(dir, bin)}
${releaseMock}
${downloadMock(binary, checksum)}
${invokeInstaller}
${invokeInstaller}
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    expect(readFileSync(userPathFile(dir), "utf8")).toBe(`${bin};${before}`);
    expect(result.stdout).toContain(`added ${bin} to the user PATH`);
    expect(result.stdout).toContain("already on the user PATH");
    expect(result.stdout).not.toContain("setx");
  });

  it("matches an existing entry case-insensitively and ignoring a trailing backslash", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const before = `C:\\keep;${bin.toUpperCase()}\\`;
    writeFileSync(userPathFile(dir), before);
    const wrapper = writeWrapper(
      dir,
      "idempotent.ps1",
      `
${prelude(dir, bin)}
${releaseMock}
${downloadMock(binary, checksum)}
${invokeInstaller}
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    expect(readFileSync(userPathFile(dir), "utf8")).toBe(before);
    expect(result.stdout).toContain("already on the user PATH");
  });

  it("leaves existing entries, %VAR% tokens, and a long PATH byte-identical", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const entries = ["%USERPROFILE%\\bin", "%TOOLS_HOME%\\cli", ...Array.from({ length: 40 }, (_, i) => `C:\\vendor\\package-${i}\\${"x".repeat(20)}\\bin`)];
    const before = entries.join(";");
    expect(before.length).toBeGreaterThan(1024);
    writeFileSync(userPathFile(dir), before);
    const wrapper = writeWrapper(
      dir,
      "preserve.ps1",
      `
${prelude(dir, bin)}
${releaseMock}
${downloadMock(binary, checksum)}
${invokeInstaller}
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    const after = readFileSync(userPathFile(dir), "utf8");
    expect(after).toBe(`${bin};${before}`);
    expect(after.slice(bin.length + 1)).toBe(before);
  });

  it("replaces an existing install in place", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const target = join(bin, "diffle.exe");
    mkdirSync(bin, { recursive: true });
    writeFileSync(target, "previous release");
    const wrapper = writeWrapper(
      dir,
      "replace.ps1",
      `
${prelude(dir, bin, { DIFFLE_NO_MODIFY_PATH: "1" })}
${releaseMock}
${downloadMock(binary, checksum)}
${invokeInstaller}
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(binary);
  });

  (process.platform === "win32" ? it : it.skip)("fails with a stop-it-first message when the installed binary cannot be replaced", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const target = join(bin, "diffle.exe");
    mkdirSync(bin, { recursive: true });
    writeFileSync(target, "in use");
    // an exclusive handle stands in for a running diffle.exe, which windows refuses to overwrite
    const wrapper = writeWrapper(
      dir,
      "locked.ps1",
      `
${prelude(dir, bin, { DIFFLE_NO_MODIFY_PATH: "1" })}
${releaseMock}
${downloadMock(binary, checksum)}
$Lock = [IO.File]::Open('${psPath(target)}', [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
try { ${invokeInstaller}; exit 99 }
catch { [Console]::Error.WriteLine($_.Exception.Message); exit 42 }
finally { $Lock.Dispose() }
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(42);
    expect(result.stderr).toContain(`diffle install: could not replace ${target}`);
    expect(result.stderr).toContain("stop every running diffle first");
    expect(result.stderr).toContain("diffle cleanup --all");
    expect(readFileSync(target, "utf8")).toBe("in use");
    expect(readdirSync(bin)).toEqual(["diffle.exe"]);
  });

  it("writes nothing on a dry run and reports the plan", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const wrapper = writeWrapper(
      dir,
      "dryrun.ps1",
      `
${prelude(dir, bin, { DIFFLE_DRY_RUN: "1" })}
${releaseMock}
function Invoke-WebRequest { throw 'download should not run' }
${invokeInstaller}
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("dry run: would install it to");
    expect(result.stdout).toContain(`dry run: would prepend ${bin} to the user PATH`);
    expect(existsSync(join(bin, "diffle.exe"))).toBe(false);
    expect(existsSync(userPathFile(dir))).toBe(false);
  });

  it("removes only our entry and the binary on uninstall", async () => {
    const dir = tempDir();
    const bin = join(dir, "bin");
    const target = join(bin, "diffle.exe");
    mkdirSync(bin, { recursive: true });
    writeFileSync(target, binary);
    const survivors = "C:\\keep;%USERPROFILE%\\bin";
    writeFileSync(userPathFile(dir), `${bin};${survivors}`);
    const wrapper = writeWrapper(
      dir,
      "uninstall.ps1",
      `
${prelude(dir, bin, { DIFFLE_UNINSTALL: "1" })}
function Invoke-RestMethod { throw 'uninstall should not reach the network' }
${invokeInstaller}
`,
    );

    const result = await run(pwsh!, ["-NoProfile", "-File", wrapper], dir);
    expect(result.code).toBe(0);
    expect(existsSync(target)).toBe(false);
    expect(readFileSync(userPathFile(dir), "utf8")).toBe(survivors);
    expect(result.stdout).toContain(`removed ${bin} from the user PATH`);
  });
});
