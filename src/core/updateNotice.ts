// terminal release messaging: the one-line launch notice (at most one network check per day,
// cached in the user state file), the `update --check` report, and the hint shared with doctor.

import { basename } from "node:path";
import { homedir } from "node:os";
import type { UpdateStatus } from "../types";
import { PRODUCT } from "./product";
import { currentVersion, fetchReleaseTags, latestVersion } from "./updateCheck";
import { detectPackageManager, managerCommand } from "./updateTarget";
import { readUserState, writeUserState } from "./userState";
import { isProductBinary } from "../utils/installRoot";
import { productEnv } from "../utils/env";

export const UPDATE_CHECK_OPT_OUT = "NO_UPDATE_CHECK";
const THROTTLE_MS = 24 * 60 * 60 * 1000;
const SOURCE_NOTE = "source checkout — use git pull";
const SOURCE_HINT = "use git pull (source checkout)";

type FetchTags = () => Promise<string[]>;

export interface LaunchNoticeDeps {
  now?: () => number;
  home?: string;
  fetchTags?: FetchTags;
  isInstalled?: boolean; // false in a source checkout, where package.json always looks behind
}

export const runningAsBinary = (): boolean => isProductBinary(basename(process.execPath));
export const updateCheckDisabled = (): boolean => Boolean(productEnv(UPDATE_CHECK_OPT_OUT));

function toStatus(current: string, latest: string): UpdateStatus {
  return { behind: latest !== current, current, latest };
}

// how to get the newer release: the owning package manager's command, else `diffle update`.
export function updateHint(isInstalled = runningAsBinary(), execPath = process.execPath): string {
  if (!isInstalled) return SOURCE_HINT;
  const manager = detectPackageManager(execPath);
  const command = manager ? managerCommand(manager) : `${PRODUCT.name} update`;
  return command.startsWith("use ") ? command : `run ${command}`;
}

// live check against GitHub Releases; null when the channel is unreachable or empty.
export async function fetchReleaseStatus(loupeRoot: string, fetchTags: FetchTags = fetchReleaseTags): Promise<UpdateStatus | null> {
  const tags = await fetchTags().catch(() => []);
  if (tags.length === 0) return null;
  const current = currentVersion(loupeRoot);
  return toStatus(current, latestVersion(current, tags));
}

// the launch notice text, or null. inside 24 h of the last successful check it reuses the cached
// latest version instead of hitting GitHub. never throws — a failed check is just silent.
export async function launchUpdateNotice(loupeRoot: string, deps: LaunchNoticeDeps = {}): Promise<string | null> {
  const { now = Date.now, home = homedir(), fetchTags = fetchReleaseTags, isInstalled = runningAsBinary() } = deps;
  if (!isInstalled || updateCheckDisabled() || process.env.CI) return null;
  try {
    const state = readUserState(home);
    const age = now() - Date.parse(state.updateCheckedAt ?? "");
    let latest = state.latestKnownVersion;
    if (!latest || !(age >= 0 && age < THROTTLE_MS)) {
      const fresh = await fetchReleaseStatus(loupeRoot, fetchTags);
      if (!fresh) return null;
      latest = fresh.latest;
      writeUserState({ updateCheckedAt: new Date(now()).toISOString(), latestKnownVersion: latest }, home);
    }
    const current = currentVersion(loupeRoot);
    const status = toStatus(current, latestVersion(current, [latest]));
    return status.behind ? `v${status.latest} available — ${updateHint(isInstalled)}` : null;
  } catch {
    return null;
  }
}

// the `update --check` line.
export function updateCheckReport(status: UpdateStatus | null, isInstalled = runningAsBinary()): string {
  if (!status) return "could not reach GitHub to check for releases";
  if (!status.behind) return `v${status.current} is the latest release${isInstalled ? "" : ` (${SOURCE_NOTE})`}`;
  return isInstalled
    ? `v${status.latest} available (installed v${status.current}) — ${updateHint(isInstalled)}`
    : `v${status.latest} available (installed v${status.current}, ${SOURCE_NOTE})`;
}
