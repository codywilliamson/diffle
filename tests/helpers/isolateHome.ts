// bun test preload: points every home-derived location at a throwaway dir, so no test (or cli
// child it spawns) can touch the developer's real agent configs, plugins, or data dir. the
// first-run migration rewrites those, so this is a safety net, not a convenience.

import { mock } from "bun:test";
import * as os from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";

const home = mkdtempSync(join(os.tmpdir(), "nittle-test-home-"));

// children read these; bun caches os.homedir() on posix, so in-process callers need the mock too
process.env.HOME = home;
process.env.USERPROFILE = home;
process.env.XDG_CONFIG_HOME = join(home, ".config");
process.env.APPDATA = join(home, "AppData", "Roaming");
process.env.CLAUDE_CONFIG_DIR = join(home, ".claude");
process.env.CODEX_HOME = join(home, ".codex");

const isolated = { ...os, homedir: () => home };
mock.module("node:os", () => ({ ...isolated, default: isolated }));
mock.module("os", () => ({ ...isolated, default: isolated }));
