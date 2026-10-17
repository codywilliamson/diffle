// the assertions of the upgrade smoke: what a user must find after `diffle update` and a fresh shell.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCT } from "../../src/core/product";
import { EXE, WINDOWS, type Sandbox } from "./sandbox";
import { PROFILE_LINES, profilePath, type Seeded } from "./seed";
import type { ShellView } from "./freshShell";

export interface Check { name: string; ok: boolean; detail: string; }

const OLD = new RegExp(PRODUCT.legacyName, "i");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
const tryReadJson = (path: string) => { try { return readJson(path); } catch { return undefined; } };

// every file or directory under `dir` whose name mentions diffle
export function namedDiffle(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (OLD.test(entry.name)) found.push(path);
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(path);
    }
  };
  walk(dir);
  return found;
}

export interface CheckInput {
  box: Sandbox;
  seeded: Seeded;
  shell: ShellView;
  version: string; // the version the new binary is built as
  noticeOutput: string; // output of the printed `diffle --version` step
}

export function runChecks({ box, seeded, shell, version, noticeOutput }: CheckInput): Check[] {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail: ok ? "" : detail });
  const nittleDir = join(box.home, PRODUCT.dataDir);

  check("nittle works from the fresh shell's PATH", shell.version === `${PRODUCT.name} v${version}`, `version line: "${shell.version}"`);
  check("it resolves to ~/.nittle/bin", shell.which.toLowerCase() === join(nittleDir, "bin", `${PRODUCT.name}${EXE}`).toLowerCase(), `resolved: "${shell.which}"`);
  const entries = shell.path.split(WINDOWS ? ";" : ":");
  check("no PATH entry mentions diffle", !entries.some((entry) => OLD.test(entry)), entries.filter((entry) => OLD.test(entry)).join(", "));

  for (const [id, record] of Object.entries(seeded.records)) {
    const migrated = tryReadJson(join(nittleDir, "reviews", id, "review.json"));
    check(`review record ${id} is intact`, migrated !== undefined && Bun.deepEquals(migrated, record, true), migrated ? "contents differ" : "missing");
  }
  const state = tryReadJson(join(nittleDir, "state.json"));
  check("prefs (state.json) carried over", state !== undefined && Object.entries(seeded.state).every(([key, value]) => state[key] === value), JSON.stringify(state));

  const leftovers = namedDiffle(box.home);
  check("no file or directory named diffle under HOME", leftovers.length === 0, leftovers.join("\n"));
  for (const file of seeded.agentFiles) {
    const text = existsSync(file) ? readFileSync(file, "utf8") : "";
    check(`agent config ${file.replace(box.home, "~")} no longer mentions diffle and launches nittle`, text !== "" && !OLD.test(text) && text.includes(PRODUCT.name), OLD.test(text) ? "still mentions diffle" : "missing or no nittle entry");
  }
  const cursor = tryReadJson(join(box.home, ".cursor", "mcp.json"));
  check("unrelated MCP servers are untouched", Bun.deepEquals((cursor?.mcpServers as Record<string, unknown> | undefined)?.other, seeded.untouched.other, true), JSON.stringify(cursor));

  if (!WINDOWS) {
    const rc = existsSync(profilePath(box.home)) ? readFileSync(profilePath(box.home), "utf8") : "";
    const block = `\n# >>> ${PRODUCT.name} >>>\nexport PATH="${join(nittleDir, "bin")}:$PATH"\n# <<< ${PRODUCT.name} <<<\n`;
    check("only the installer's PATH block changed in the rc file", rc === PROFILE_LINES + block, rc);
  } else if (box.scopeFile) {
    const user = existsSync(box.scopeFile) ? readFileSync(box.scopeFile, "utf8") : "";
    check("the user PATH holds ~/.nittle/bin once and no diffle entry", user.split(";").filter((entry) => entry.toLowerCase() === join(nittleDir, "bin").toLowerCase()).length === 1 && !OLD.test(user), user);
  }
  check("the DIFFLE_ env notice was shown", noticeOutput.includes("DIFFLE_NO_UPDATE_CHECK -> NITTLE_NO_UPDATE_CHECK"), noticeOutput);
  return checks;
}
