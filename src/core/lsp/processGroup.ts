// stops a language server and everything it spawned. on posix the server leads its own process
// group (see bridge spawn), so one signal to -pid reaches tsserver and friends; windows has no
// groups, so taskkill walks the tree instead.

import { existsSync } from "node:fs";

export const KILL_GRACE_MS = 1_000; // between SIGTERM and SIGKILL
const POLL_MS = 25;
const IS_WINDOWS = process.platform === "win32";

export const usesProcessGroups = !IS_WINDOWS;

function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try { process.kill(-pid, signal); return true; } catch { return false; } // ESRCH: nothing left
}

// absolute system path: a bare name would resolve through PATH, which a checkout can influence
export function systemTaskkill(): string {
  return `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\taskkill.exe`;
}

// one taskkill for all the pids, so n servers cost one process start, not n. it carries on past a pid
// that is already gone (tested). it is not time-bounded: a spawn timeout fired at once under bun test.
function taskkillTrees(pids: readonly number[]): void {
  const exe = systemTaskkill();
  if (!existsSync(exe)) { for (const pid of pids) { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } } return; }
  const targets = pids.flatMap((pid) => ["/PID", String(pid)]);
  Bun.spawnSync([exe, ...targets, "/T", "/F"], { stdout: "ignore", stderr: "ignore" });
}

// sync and blunt, for exit handlers that cannot await. one call for any number of servers, so the
// windows cost does not grow per server (a closing console allows about five seconds in all).
export function killTreesNow(pids: readonly number[]): void {
  if (pids.length === 0) return;
  if (IS_WINDOWS) taskkillTrees(pids); else for (const pid of pids) signalGroup(pid, "SIGKILL");
}

export const killTreeNow = (pid: number): void => killTreesNow([pid]);

// polite, bounded: SIGTERM the group, give it KILL_GRACE_MS to leave, then SIGKILL what is left.
export async function reapTree(pid: number, graceMs = KILL_GRACE_MS): Promise<void> {
  if (IS_WINDOWS) return taskkillTrees([pid]);
  if (!signalGroup(pid, 0)) return;
  signalGroup(pid, "SIGTERM");
  const deadline = Date.now() + graceMs;
  while (signalGroup(pid, 0) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  signalGroup(pid, "SIGKILL");
}
