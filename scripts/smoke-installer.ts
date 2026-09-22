// exercises the published release through the checked-in installers on each runner OS.
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "../src/core/product";

const tag = process.env.TAG;
if (!tag?.startsWith("v")) throw new Error("TAG=vX.Y.Z is required");

const root = join(import.meta.dir, "..");
const tempRoot = process.env.RUNNER_TEMP ?? tmpdir();
const logPath = join(tempRoot, "diffle-installer-smoke.log");
const windows = process.platform === "win32";
const shells = windows ? ["pwsh"] : process.platform === "linux" ? ["sh", "dash"] : ["sh"];
const dirs: string[] = [];
writeFileSync(logPath, "");

function run(command: string, args: string[], cwd: string, env: Record<string, string>): string {
  const result = Bun.spawnSync([command, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
  const output = `${result.stdout.toString()}${result.stderr.toString()}`;
  appendFileSync(logPath, `$ ${command} ${args.join(" ")}\n${output}\n`);
  process.stdout.write(output);
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} exited ${result.exitCode}`);
  return result.stdout.toString().trim();
}

try {
  for (const shell of shells) {
    const installDir = mkdtempSync(join(tempRoot, `diffle-installer-${shell}-`));
    dirs.push(installDir);
    const env = {
      ...process.env,
      DIFFLE_INSTALL_DIR: installDir,
      DIFFLE_NO_MODIFY_PATH: "1",
      DIFFLE_NO_UPDATE_CHECK: "1",
    } as Record<string, string>;
    delete env.DIFFLE_UNINSTALL;
    const script = join(root, windows ? "install.ps1" : "install.sh");
    const command = windows ? "pwsh" : shell;
    const args = windows ? ["-NoProfile", "-File", script] : [script];

    run(command, args, root, env);
    const binary = join(installDir, `${PRODUCT.name}${windows ? ".exe" : ""}`);
    if (!existsSync(binary)) throw new Error(`${shell} did not install ${binary}`);
    const reported = run(binary, ["--version"], installDir, env);
    if (reported !== `${PRODUCT.name} ${tag}`) throw new Error(`${shell} installed ${reported}, expected ${tag}`);

    run(command, args, root, { ...env, DIFFLE_UNINSTALL: "1" });
    if (existsSync(binary)) throw new Error(`${shell} uninstall left ${binary}`);
    console.log(`${shell} installer smoke passed: ${tag}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  appendFileSync(logPath, `FAIL: ${message}\n`);
  throw error;
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}
