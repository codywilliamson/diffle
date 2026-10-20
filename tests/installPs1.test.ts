import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findPwsh } from "./helpers/findPwsh";

// install.ps1 needs PowerShell 7. every wrapper mocks the release lookup and downloads and routes the
// "user PATH" through a scope file, so no test touches the network, the registry or the real home.
const pwsh = findPwsh();
if (!pwsh) console.warn("install.ps1 tests skipped: pwsh (PowerShell 7+) is not on PATH");
const root = join(import.meta.dir, "..");
const dirs: string[] = [];
setDefaultTimeout(60_000);
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

// the "nittle.exe" the installer downloads and then runs with --version must be a real, harmless
// executable on windows (a text file named .exe makes windows log loader errors). hostname.exe is a
// tiny system exe that exits right away; elsewhere the file is never executed, so any bytes do.
const PAYLOAD_FILE = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\Windows", "System32", "hostname.exe") : join(tmpdir(), "install-ps1-payload.bin");
if (process.platform !== "win32") writeFileSync(PAYLOAD_FILE, "nittle-binary");
const PAYLOAD = readFileSync(PAYLOAD_FILE);
const SUM = createHash("sha256").update(PAYLOAD).digest("hex");
const q = (text: string) => text.replaceAll("'", "''");

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "install-ps1-"));
  dirs.push(dir);
  return dir;
}

const releaseMock = (assets = ["nittle-windows-x64.exe", "checksums.txt"], sum = SUM) => `
function Invoke-RestMethod { [pscustomobject]@{ tag_name = 'v9.9.9'; assets = @(${assets.map((name) => `[pscustomobject]@{ name = '${name}'; browser_download_url = 'mock:${name}' }`).join(", ")}) } }
function Invoke-WebRequest {
  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, $ErrorAction)
  if ($Uri -eq 'mock:checksums.txt') { [IO.File]::WriteAllText($OutFile, '${sum}  nittle-windows-x64.exe' + [Environment]::NewLine) }
  else { Copy-Item -LiteralPath '${q(PAYLOAD_FILE)}' -Destination $OutFile -Force }
}`;

interface Scenario {
  env?: Record<string, string>;
  userPath?: string;
  mock?: string;
  before?: (dir: string) => void;
  reuse?: string; // run inside an already prepared temp dir
}

async function run(scenario: Scenario = {}): Promise<{ code: number; out: string; dir: string; userPath: string; bin: string; legacyBin: string }> {
  const dir = scenario.reuse ?? tempDir();
  const bin = join(dir, "home", ".nittle", "bin");
  const legacyBin = join(dir, "home", ".diffle", "bin");
  const scope = join(dir, "userpath.txt");
  if (scenario.userPath !== undefined) writeFileSync(scope, scenario.userPath.replaceAll("<legacy>", legacyBin).replaceAll("<bin>", bin).replaceAll("<dir>", dir));
  scenario.before?.(dir);
  const env: Record<string, string> = {
    PROCESSOR_ARCHITECTURE: "AMD64", NITTLE_INSTALL_DIR: bin, DIFFLE_INSTALL_DIR: legacyBin, NITTLE_PATH_SCOPE_FILE: scope, ...scenario.env,
  };
  const prelude = Object.entries(env).map(([key, value]) => (value === "" ? `Remove-Item Env:${key} -ErrorAction SilentlyContinue` : `$env:${key} = '${q(value.replaceAll("<dir>", dir))}'`)).join("\n");
  const wrapper = join(dir, "wrapper.ps1");
  writeFileSync(wrapper, `${prelude}\n${scenario.mock ?? releaseMock()}\n$script:Failure = $null\n$Name = 'mine'\ntry { Invoke-Expression (Get-Content -Raw -LiteralPath '${q(join(root, "install.ps1"))}') } catch { [Console]::Error.WriteLine("FAILED: " + $_.Exception.Message); exit 42 }\nif ($Name -ne 'mine') { [Console]::Error.WriteLine("CLOBBERED: Name is " + $Name); exit 43 }\n`);
  const proc = Bun.spawn([pwsh!, "-NoProfile", "-File", wrapper], { stdout: "pipe", stderr: "pipe", cwd: dir, env: { ...process.env, HOME: join(dir, "home"), USERPROFILE: join(dir, "home") } });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out: stdout + stderr, dir, userPath: existsSync(scope) ? readFileSync(scope, "utf8") : "", bin, legacyBin };
}

const seed = (path: string, text = "x") => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, text); };

describe.skipIf(!pwsh)("install.ps1", () => {
  test("installs the nittle asset and prepends ~/.nittle/bin to the user PATH once", async () => {
    const first = await run({ userPath: "C:\\Windows;%SystemRoot%\\x" });
    expect(first.code).toBe(0);
    expect(readFileSync(join(first.bin, "nittle.exe")).equals(PAYLOAD)).toBe(true);
    expect(first.userPath).toBe(`${first.bin};C:\\Windows;%SystemRoot%\\x`);
    expect(first.out).not.toContain("Migrate diffle");
    expect(existsSync(first.legacyBin)).toBe(false);
  });

  test("an existing nittle PATH entry is not duplicated", async () => {
    const again = await run({ userPath: "<bin>;C:\\Windows" });
    expect(again.userPath).toBe(`${again.bin};C:\\Windows`);
  });

  test("a dry run changes nothing", async () => {
    const result = await run({ env: { NITTLE_DRY_RUN: "1" }, userPath: "C:\\Windows" });
    expect(result.code).toBe(0);
    expect(existsSync(join(result.bin, "nittle.exe"))).toBe(false);
    expect(result.userPath).toBe("C:\\Windows");
  });

  test("NITTLE_INSTALL_DIR wins over DIFFLE_INSTALL_DIR, which still works alone", async () => {
    const both = await run({ env: { NITTLE_INSTALL_DIR: "<dir>\\a", DIFFLE_INSTALL_DIR: "<dir>\\b", NITTLE_NO_MODIFY_PATH: "1" } });
    expect(existsSync(join(both.dir, "a", "nittle.exe"))).toBe(true);
    expect(existsSync(join(both.dir, "b", "nittle.exe"))).toBe(false);
    const fallback = await run({ env: { NITTLE_INSTALL_DIR: "", DIFFLE_INSTALL_DIR: "<dir>\\b", DIFFLE_NO_MODIFY_PATH: "1" }, userPath: "C:\\Windows" });
    expect(existsSync(join(fallback.dir, "b", "nittle.exe"))).toBe(true);
    expect(fallback.userPath).toBe("C:\\Windows");
  });

  test("an existing diffle install triggers one `nittle --version` and leaves the diffle files to the binary", async () => {
    const result = await run({
      userPath: "<legacy>;C:\\Windows",
      before: (dir) => seed(join(dir, "home", ".diffle", "bin", "diffle.exe"), "old"),
    });
    expect(result.code).toBe(0);
    expect(result.out).toContain("existing diffle install");
    expect(result.out.match(/install migrated|'nittle --version' failed/g)).toHaveLength(1);
    expect(existsSync(join(result.legacyBin, "diffle.exe"))).toBe(true);
    expect(result.userPath).toBe(`${result.bin};${result.legacyBin};C:\\Windows`);
  });

  test("a custom-dir diffle install is found on the user PATH and named to the binary", async () => {
    const result = await run({
      env: { DIFFLE_INSTALL_DIR: "" },
      userPath: `${join("<dir>", "tools", "diffle-bin")};C:\\Windows`,
      before: (dir) => seed(join(dir, "tools", "diffle-bin", "diffle.exe"), "old"),
    });
    expect(result.code).toBe(0);
    expect(result.out).toContain(`migrating the diffle install in ${join(result.dir, "tools", "diffle-bin")}`);
  });

  test("--uninstall removes a custom-dir diffle install it discovered", async () => {
    const result = await run({
      env: { NITTLE_UNINSTALL: "1", NITTLE_NO_SETUP: "1", DIFFLE_INSTALL_DIR: "" },
      userPath: join("<dir>", "tools", "diffle-bin"),
      before: (dir) => seed(join(dir, "tools", "diffle-bin", "diffle.exe")),
    });
    expect(result.code).toBe(0);
    expect(existsSync(join(result.dir, "tools", "diffle-bin"))).toBe(false);
    expect(result.userPath).toBe("");
  });

  test("a checksum mismatch keeps the machine untouched", async () => {
    const result = await run({ mock: releaseMock(undefined, "0".repeat(64)), userPath: "C:\\Windows" });
    expect(result.code).toBe(42);
    expect(result.out).toContain("nittle install: checksum mismatch for nittle-windows-x64.exe");
    expect(existsSync(join(result.bin, "nittle.exe"))).toBe(false);
  });

  test("a release without the nittle asset names it", async () => {
    const result = await run({ mock: releaseMock(["diffle-windows-x64.exe", "checksums.txt"]) });
    expect(result.code).toBe(42);
    expect(result.out).toContain("missing required asset(s): nittle-windows-x64.exe");
  });

  test("each DIFFLE_* fallback in use prints one notice naming its NITTLE_* replacement", async () => {
    const used = await run({ env: { NITTLE_INSTALL_DIR: "", DIFFLE_INSTALL_DIR: "<dir>\\b", DIFFLE_NO_MODIFY_PATH: "1" }, userPath: "C:\\Windows" });
    expect(used.out.match(/DIFFLE_INSTALL_DIR is deprecated.*set NITTLE_INSTALL_DIR instead/g)?.length).toBe(1);
    expect(used.out.match(/DIFFLE_NO_MODIFY_PATH is deprecated.*set NITTLE_NO_MODIFY_PATH instead/g)?.length).toBe(1);
    expect(used.out).not.toContain("DIFFLE_DRY_RUN");
    const shadowed = await run({ env: { NITTLE_INSTALL_DIR: "<dir>\\a", DIFFLE_INSTALL_DIR: "<dir>\\b", NITTLE_NO_MODIFY_PATH: "1" } });
    expect(shadowed.out).not.toContain("is deprecated");
  });

  test("a user PATH stored with a trailing newline is read and compared normalized", async () => {
    const again = await run({ userPath: "C:\\Windows;<bin>\n" });
    expect(again.out).toContain("already on the user PATH");
    expect(again.userPath).toBe(`C:\\Windows;${again.bin}\n`);
    const gone = await run({
      env: { NITTLE_UNINSTALL: "1", NITTLE_NO_SETUP: "1" },
      userPath: "<legacy>;C:\\Windows;<bin>\r\n",
      before: (dir) => seed(join(dir, "home", ".nittle", "bin", "nittle.exe")),
    });
    expect(gone.code).toBe(0);
    expect(gone.userPath).toBe("C:\\Windows");
    expect(gone.out).not.toContain("is not on the user PATH");
  });

  test("--uninstall removes nittle and every diffle leftover but keeps non-empty data", async () => {
    const result = await run({
      env: { NITTLE_UNINSTALL: "1", NITTLE_NO_SETUP: "1" },
      userPath: "<legacy>;C:\\Windows;<bin>",
      before: (dir) => {
        seed(join(dir, "home", ".nittle", "bin", "nittle.exe"));
        seed(join(dir, "home", ".nittle", "state.json"), "{}");
        seed(join(dir, "home", ".diffle", "bin", "diffle.exe"));
        seed(join(dir, "home", ".diffle", "bin", ".diffle.exe.old"));
      },
    });
    expect(result.code).toBe(0);
    expect(result.userPath).toBe("C:\\Windows");
    expect(existsSync(result.bin)).toBe(false);
    expect(existsSync(join(result.dir, "home", ".diffle"))).toBe(false);
    expect(readdirSync(join(result.dir, "home", ".nittle"))).toEqual(["state.json"]);
  });

  test.skipIf(process.platform !== "win32")("--uninstall with a locked exe says plainly it could not remove it and names the path", async () => {
    const dir = tempDir();
    const locked = join(dir, "home", ".diffle", "bin", "diffle.exe");
    mkdirSync(join(locked, ".."), { recursive: true });
    writeFileSync(locked, readFileSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "ping.exe")));
    const holder = Bun.spawn([locked, "-n", "30", "127.0.0.1"], { stdout: "ignore", stderr: "ignore" });
    try {
      await Bun.sleep(300);
      const result = await run({ env: { NITTLE_UNINSTALL: "1", NITTLE_NO_SETUP: "1" }, reuse: dir });
      expect(result.code).toBe(0);
      expect(result.out).toContain(`could not remove ${locked} because it is in use`);
      expect(result.out).toContain(`delete it yourself: ${locked}`);
      expect(existsSync(locked)).toBe(true);
    } finally {
      holder.kill();
      await holder.exited;
    }
  });

  test("--uninstall deletes only installer leftovers: .nittle.settings and .diffle.notes survive", async () => {
    const result = await run({
      env: { NITTLE_UNINSTALL: "1", NITTLE_NO_SETUP: "1" },
      before: (dir) => {
        seed(join(dir, "home", ".nittle", "bin", "nittle.exe"));
        seed(join(dir, "home", ".nittle", "bin", ".nittle.settings"));
        seed(join(dir, "home", ".nittle", "bin", ".nittle.exe.old"));
        seed(join(dir, "home", ".diffle", "bin", "diffle.exe"));
        seed(join(dir, "home", ".diffle", "bin", ".diffle.notes"));
        seed(join(dir, "home", ".diffle", "bin", ".diffle.new-12-ab"));
      },
    });
    expect(result.code).toBe(0);
    expect(readdirSync(result.bin)).toEqual([".nittle.settings"]);
    expect(readdirSync(result.legacyBin)).toEqual([".diffle.notes"]);
  });

  test("--uninstall removes an empty data dir, and also reads DIFFLE_UNINSTALL", async () => {
    const result = await run({
      env: { NITTLE_UNINSTALL: "", DIFFLE_UNINSTALL: "1", NITTLE_NO_SETUP: "1" },
      before: (dir) => seed(join(dir, "home", ".nittle", "bin", "nittle.exe")),
    });
    expect(result.code).toBe(0);
    expect(existsSync(join(result.dir, "home", ".nittle"))).toBe(false);
  });

  test("--uninstall --dry-run removes nothing", async () => {
    const result = await run({
      env: { NITTLE_UNINSTALL: "1", NITTLE_DRY_RUN: "1" },
      userPath: "<bin>",
      before: (dir) => seed(join(dir, "home", ".nittle", "bin", "nittle.exe")),
    });
    expect(existsSync(join(result.bin, "nittle.exe"))).toBe(true);
    expect(result.userPath).toBe(result.bin);
  });
});

const COMPLETION_LINE = "if (Get-Command nittle -ErrorAction SilentlyContinue) { nittle completion --shell powershell | Out-String | Invoke-Expression }";
const BLOCK = "# >>> nittle >>>\n# <<< nittle <<<\n";

describe.skipIf(!pwsh)("install.ps1 completions offer", () => {
  const profileOf = (dir: string) => join(dir, "profile.ps1");
  const offer = (answer: string | undefined, extra: Record<string, string> = {}) => ({
    NITTLE_PROFILE_FILE: "<dir>/profile.ps1", NITTLE_NO_SETUP: "1", ...(answer === undefined ? {} : { NITTLE_TEST_COMPLETIONS_ANSWER: answer }), ...extra,
  });
  const seedBlock = (dir: string) => seed(profileOf(dir), `# mine\n${BLOCK}`);

  test("yes adds the line inside an existing nittle block, before the end marker", async () => {
    const result = await run({ env: offer("y"), before: seedBlock });
    expect(result.code).toBe(0);
    expect(readFileSync(profileOf(result.dir), "utf8")).toBe(`# mine\n# >>> nittle >>>\n${COMPLETION_LINE}\n# <<< nittle <<<\n`);
  });

  test("yes without a nittle block prints the line and never writes the profile", async () => {
    const result = await run({ env: offer("y"), before: (dir) => seed(profileOf(dir), "# mine\n") });
    expect(result.code).toBe(0);
    expect(result.out).toContain(COMPLETION_LINE);
    expect(readFileSync(profileOf(result.dir), "utf8")).toBe("# mine\n");
    const none = await run({ env: offer("y") });
    expect(existsSync(profileOf(none.dir))).toBe(false);
  });

  test("rerunning does not duplicate the line", async () => {
    const first = await run({ env: offer("y"), before: seedBlock });
    await run({ env: offer("y"), reuse: first.dir });
    const text = readFileSync(profileOf(first.dir), "utf8");
    expect(text.split("completion --shell powershell").length).toBe(2);
  });

  test("no and the default answer add nothing", async () => {
    const no = await run({ env: offer("n"), before: seedBlock });
    expect(readFileSync(profileOf(no.dir), "utf8")).toBe(`# mine\n${BLOCK}`);
    const blank = await run({ env: offer(" "), before: seedBlock });
    expect(readFileSync(profileOf(blank.dir), "utf8")).toBe(`# mine\n${BLOCK}`);
  });

  test("NITTLE_NO_COMPLETIONS skips the offer", async () => {
    const result = await run({ env: offer("y", { NITTLE_NO_COMPLETIONS: "1" }), before: seedBlock });
    expect(result.out).not.toContain("Completions");
    expect(readFileSync(profileOf(result.dir), "utf8")).toBe(`# mine\n${BLOCK}`);
  });

  test("a non-interactive run skips the offer", async () => {
    const result = await run({ env: offer(undefined), before: seedBlock });
    expect(result.code).toBe(0);
    expect(result.out).not.toContain("Completions");
    expect(readFileSync(profileOf(result.dir), "utf8")).toBe(`# mine\n${BLOCK}`);
  });

  test("a dry run skips the offer", async () => {
    const result = await run({ env: offer("y", { NITTLE_DRY_RUN: "1" }), before: seedBlock });
    expect(result.out).not.toContain("Completions");
  });
});

// windows powershell 5.1 gets the requirement message and installs nothing
const winPowerShell = process.platform === "win32" ? Bun.which("powershell") : null;

describe.skipIf(!winPowerShell)("install.ps1 under windows powershell 5.1", () => {
  test("prints the pwsh 7 requirement and installs nothing", async () => {
    const dir = tempDir();
    const home = join(dir, "home");
    const bin = join(home, ".nittle", "bin");
    const scope = join(dir, "userpath.txt");
    mkdirSync(home, { recursive: true });
    const script = join(dir, "run.ps1");
    writeFileSync(script, `Invoke-Expression (Get-Content -Raw -LiteralPath '${q(join(root, "install.ps1"))}')\n`);
    const env = { ...process.env, HOME: home, USERPROFILE: home, NITTLE_INSTALL_DIR: bin, NITTLE_PATH_SCOPE_FILE: scope };
    const proc = Bun.spawn([winPowerShell!, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], { stdout: "pipe", stderr: "pipe", cwd: dir, env });
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
    const code = await proc.exited;
    const out = stdout + stderr;
    expect(code).not.toBe(0);
    expect(out).toContain("nittle needs PowerShell 7 or later");
    expect(out).toContain("PowerShell 7 or newer is required");
    expect(out).toContain("winget install --id Microsoft.PowerShell --source winget");
    expect(out).toContain('pwsh -NoProfile -c "irm https://nittle.dev/install.ps1 | iex"');
    expect(existsSync(bin)).toBe(false);
    expect(existsSync(scope)).toBe(false);
    expect(existsSync(join(home, '.nittle'))).toBe(false);
  });
});
