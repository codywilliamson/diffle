// runs the real install.sh against a fake release: shims for `uname` and `curl` serve a canned
// nittle binary (a shell script that logs its argv), so no network and no real home is involved.

import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

export const REPO_ROOT = join(import.meta.dir, "..", "..");
export const TAG = "v9.9.9";
export const ASSET = "nittle-linux-x64";
const FAKE_BINARY = `#!/bin/sh\necho "$*" >> "$FAKE_LOG"\necho "\${NITTLE_LEGACY_INSTALL_DIR:-}" >> "$FAKE_LOG.legacy"\n[ "$1" = completion ] && [ -n "\${FAKE_COMPLETION_HANG:-}" ] && exec sleep 30\n[ "$1" = completion ] && { echo "# fake $3 completions"; exit 0; }\necho "nittle ${TAG}"\n`;

const UNAME_SHIM = `#!/bin/sh\ncase "$1" in -m) echo x86_64 ;; *) echo Linux ;; esac\n`;
const CURL_SHIM = `#!/bin/sh
url=""; out=""
while [ $# -gt 0 ]; do
  case "$1" in -o) out="$2"; shift 2 ;; -H) shift 2 ;; -*) shift ;; *) url="$1"; shift ;; esac
done
case "$url" in
  */releases/latest) cp "$FIXTURE/release.json" "$out" ;;
  *) cp "$FIXTURE/$(basename "$url")" "$out" || { echo "curl: (22) 404 for $url" >&2; exit 22; } ;;
esac
`;

export interface InstallSandbox {
  home: string;
  fixture: string;
  log: string;
  run(args?: string[], env?: Record<string, string>): Promise<{ code: number; out: string }>;
  cleanup(): void;
}

export interface SandboxOptions {
  assets?: string[]; // release asset names to advertise (default: the nittle one + checksums.txt)
  badChecksum?: boolean;
}

export function createInstallSandbox(options: SandboxOptions = {}): InstallSandbox {
  const root = mkdtempSync(join(tmpdir(), "install-sh-"));
  const home = join(root, "home");
  const fixture = join(root, "fixture");
  const shims = join(root, "shims");
  for (const dir of [home, fixture, shims]) mkdirSync(dir);
  for (const [name, body] of [["uname", UNAME_SHIM], ["curl", CURL_SHIM]] as const) {
    writeFileSync(join(shims, name), body);
    chmodSync(join(shims, name), 0o755);
  }
  const names = options.assets ?? [ASSET, "checksums.txt"];
  writeFileSync(join(fixture, "release.json"), JSON.stringify({ tag_name: TAG, assets: names.map((name) => ({ name })) }, null, 2));
  writeFileSync(join(fixture, ASSET), FAKE_BINARY);
  const sum = options.badChecksum ? "0".repeat(64) : createHash("sha256").update(FAKE_BINARY).digest("hex");
  writeFileSync(join(fixture, "checksums.txt"), `${sum}  ${ASSET}\n`);
  const log = join(root, "fake-nittle.log");
  writeFileSync(log, "");

  return {
    home, fixture, log,
    async run(args = [], env = {}) {
      const base: Record<string, string | undefined> = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, ".config"), FIXTURE: fixture, FAKE_LOG: log, SHELL: "/bin/zsh", NITTLE_INSTALLER_TEST: "1", PATH: [env.EXTRA_PATH, shims, process.env.PATH].filter(Boolean).join(delimiter), ...env };
      delete base.EXTRA_PATH;
      for (const key of Object.keys(base)) if (/^(NITTLE|DIFFLE)_/.test(key) && !(key in env) && key !== "NITTLE_INSTALLER_TEST") delete base[key];
      delete base.GITHUB_TOKEN;
      delete base.ZDOTDIR;
      const proc = Bun.spawn(["sh", join(REPO_ROOT, "install.sh"), ...args], { env: base as Record<string, string>, stdout: "pipe", stderr: "pipe", cwd: root });
      const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
      return { code: await proc.exited, out: out + err };
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
