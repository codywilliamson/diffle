import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { binary, checksum, cleanupTempDirs, root, run, tempDir } from "./helpers/installers";

const gitSh = Bun.which("sh") ?? (existsSync("C:\\Program Files\\Git\\usr\\bin\\sh.exe") ? "C:\\Program Files\\Git\\usr\\bin\\sh.exe" : null);

afterEach(cleanupTempDirs);

function toShPath(path: string): string {
  return path.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replaceAll("\\", "/");
}

function shWrapper(dir: string, scenario: "missing" | "success" | "checksum"): string {
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
