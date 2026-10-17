// bun test preload: points every home-derived location at a throwaway dir, so no test (or cli
// child it spawns) can touch the developer's real agent configs, plugins, or data dir. the
// first-run migration rewrites those, so this is a safety net, not a convenience.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "nittle-test-home-"));

process.env.HOME = home;
process.env.USERPROFILE = home;
process.env.XDG_CONFIG_HOME = join(home, ".config");
process.env.APPDATA = join(home, "AppData", "Roaming");
process.env.CLAUDE_CONFIG_DIR = join(home, ".claude");
process.env.CODEX_HOME = join(home, ".codex");
