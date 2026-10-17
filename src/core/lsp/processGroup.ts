// stops a language server and everything it spawned. on posix the server leads its own process
// group (see bridge spawn), so one signal to -pid reaches tsserver and friends; windows has no
// groups, so taskkill walks the tree instead.

export const KILL_GRACE_MS = 1_000; // between SIGTERM and SIGKILL
const POLL_MS = 25;
const IS_WINDOWS = process.platform === "win32";

export const usesProcessGroups = !IS_WINDOWS;

function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try { process.kill(-pid, signal); return true; } catch { return false; } // ESRCH: nothing left
}

function taskkillTree(pid: number): void {
  Bun.spawnSync(["taskkill", "/PID", String(pid), "/T", "/F"], { stdout: "ignore", stderr: "ignore" });
}

// sync and blunt, for exit handlers that cannot await.
export function killTreeNow(pid: number): void {
  if (IS_WINDOWS) taskkillTree(pid); else signalGroup(pid, "SIGKILL");
}

// polite, bounded: SIGTERM the group, give it KILL_GRACE_MS to leave, then SIGKILL what is left.
export async function reapTree(pid: number, graceMs = KILL_GRACE_MS): Promise<void> {
  if (IS_WINDOWS) return taskkillTree(pid);
  if (!signalGroup(pid, 0)) return;
  signalGroup(pid, "SIGTERM");
  const deadline = Date.now() + graceMs;
  while (signalGroup(pid, 0) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  signalGroup(pid, "SIGKILL");
}
