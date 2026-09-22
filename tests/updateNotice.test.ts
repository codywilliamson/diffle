import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { currentVersion } from "../src/core/updateCheck";
import { launchUpdateNotice, updateCheckReport, updateHint } from "../src/core/updateNotice";
import { readUserState, writeUserState } from "../src/core/userState";

const root = join(import.meta.dir, ".."); // currentVersion reads this repo's package.json
const current = currentVersion(root);
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-09-01T12:00:00.000Z");
const ENV_KEYS = ["CI", "DIFFLE_NO_UPDATE_CHECK", "LOUPE_NO_UPDATE_CHECK"];

let home: string;
let saved: Record<string, string | undefined>;
let fetches: number;

const tags = (list: string[]) => async () => { fetches++; return list; };
const notice = (fetchTags: () => Promise<string[]>, now = T0) =>
  launchUpdateNotice(root, { home, fetchTags, now: () => now, isInstalled: true });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "diffle-notice-"));
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  fetches = 0;
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("launchUpdateNotice", () => {
  it("announces a newer release and records the check under the home dir", async () => {
    expect(await notice(tags(["v999.0.0"]))).toMatch(/^v999\.0\.0 available — (run |use )/);
    expect(readUserState(home)).toMatchObject({ updateCheckedAt: new Date(T0).toISOString(), latestKnownVersion: "999.0.0" });
  });

  it("is silent when up to date", async () => {
    expect(await notice(tags([`v${current}`]))).toBeNull();
    expect(fetches).toBe(1);
  });

  it("is silent offline and does not stamp the throttle", async () => {
    expect(await notice(tags([]))).toBeNull();
    expect(await notice(async () => { throw new Error("offline"); })).toBeNull();
    expect(readUserState(home).updateCheckedAt).toBeUndefined();
  });

  it("skips outside an installed binary", async () => {
    const result = await launchUpdateNotice(root, { home, fetchTags: tags(["v999.0.0"]), now: () => T0, isInstalled: false });
    expect(result).toBeNull();
    expect(fetches).toBe(0);
  });

  it("skips when opted out via env or under CI", async () => {
    process.env.DIFFLE_NO_UPDATE_CHECK = "1";
    expect(await notice(tags(["v999.0.0"]))).toBeNull();
    delete process.env.DIFFLE_NO_UPDATE_CHECK;
    process.env.LOUPE_NO_UPDATE_CHECK = "1";
    expect(await notice(tags(["v999.0.0"]))).toBeNull();
    delete process.env.LOUPE_NO_UPDATE_CHECK;
    process.env.CI = "true";
    expect(await notice(tags(["v999.0.0"]))).toBeNull();
    expect(fetches).toBe(0);
  });

  it("reuses the cached result inside 24 h without fetching", async () => {
    await notice(tags(["v999.0.0"]));
    const cached = await notice(tags(["v999.0.0"]), T0 + DAY_MS - 1);
    expect(cached).toMatch(/^v999\.0\.0 available/);
    expect(fetches).toBe(1);
  });

  it("re-fetches after 24 h", async () => {
    await notice(tags(["v999.0.0"]));
    const later = T0 + DAY_MS;
    expect(await notice(tags(["v999.1.0"]), later)).toMatch(/^v999\.1\.0 available/);
    expect(fetches).toBe(2);
    expect(readUserState(home)).toMatchObject({ updateCheckedAt: new Date(later).toISOString(), latestKnownVersion: "999.1.0" });
  });

  it("goes quiet once the install catches up with the cached version", async () => {
    writeUserState({ updateCheckedAt: new Date(T0).toISOString(), latestKnownVersion: current }, home);
    expect(await notice(tags(["v999.0.0"]))).toBeNull();
    expect(fetches).toBe(0);
  });
});

describe("updateHint", () => {
  it("defers to the package manager that owns the install", () => {
    expect(updateHint(true, "/opt/homebrew/Cellar/diffle/0.18.0/bin/diffle")).toBe("run brew upgrade diffle");
    expect(updateHint(true, "C:\\Users\\me\\scoop\\apps\\diffle\\current\\diffle.exe")).toBe("run scoop update diffle");
    expect(updateHint(true, "C:\\Users\\me\\.diffle\\bin\\diffle.exe")).toBe("run diffle update");
    expect(updateHint(false)).toContain("git pull");
  });
});

describe("updateCheckReport", () => {
  const latest = { behind: false, current: "0.18.0", latest: "0.18.0" };
  const behind = { behind: true, current: "0.18.0", latest: "0.18.1" };

  it("reports the latest release", () => {
    expect(updateCheckReport(latest, true)).toBe("v0.18.0 is the latest release");
    expect(updateCheckReport(latest, false)).toBe("v0.18.0 is the latest release (source checkout — use git pull)");
  });

  it("reports a newer release with how to get it", () => {
    expect(updateCheckReport(behind, true)).toMatch(/^v0\.18\.1 available \(installed v0\.18\.0\) — (run |use )/);
    expect(updateCheckReport(behind, false)).toBe("v0.18.1 available (installed v0.18.0, source checkout — use git pull)");
  });

  it("reports an unreachable channel", () => {
    expect(updateCheckReport(null, true)).toBe("could not reach GitHub to check for releases");
  });
});
