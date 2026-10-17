// safety checks around the data dir move: never operate on aliased trees, never move data out from
// under a live legacy writer (fail closed when that can't be determined), and never run two
// migrations at once.

import { closeSync, existsSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { listLegacyMcpProcesses } from "../mcpProcesses";
import { isPidAlive, listSessionsIn } from "../sessions";

export const LOCK_NAME = ".nittle.migrating.lock";
// a lock whose pid can't be read is only taken over once it has clearly been abandoned
const UNREADABLE_LOCK_GRACE_MS = 60 * 1000;

const fold = (path: string) => (process.platform === "win32" ? path.toLowerCase() : path);

// true when the two paths are the same tree or one sits inside the other (symlink/junction aware).
export function treesOverlap(a: string, b: string): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  const ra = fold(realpathSync(a));
  const rb = fold(realpathSync(b));
  const inside = (parent: string, child: string) => {
    const rel = relative(parent, child);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  };
  return inside(ra, rb) || inside(rb, ra);
}

// descriptions of live processes still writing under the legacy dirs: old-binary mcp servers
// and sessions registered in those dirs whose pid is alive. throws if the process table can't be
// read, so the caller defers instead of guessing nobody is running.
export type WriterCheck = (legacyDirs: string[]) => string[];
export const findLiveLegacyWriters: WriterCheck = (legacyDirs) => {
  const found = listLegacyMcpProcesses().map((proc) => `mcp server pid ${proc.pid}`);
  for (const dir of legacyDirs) {
    for (const s of listSessionsIn(dir)) {
      if (s.pid !== process.pid && isPidAlive(s.pid)) found.push(`review session ${s.sessionId} (pid ${s.pid})`);
    }
  }
  return found;
};

function ownerPid(path: string): number | null {
  try {
    const pid = Number.parseInt(readFileSync(path, "utf8").trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

// moves a dead owner's lock aside, then re-reads it: if it turned out to be someone else's fresh
// lock (we raced another takeover), it is put back and we back off.
function takeOverDeadLock(path: string, deadPid: number | null): boolean {
  const aside = `${path}.stale-${process.pid}`;
  try {
    renameSync(path, aside);
  } catch {
    return true; // already gone: just retry the create
  }
  const grabbed = ownerPid(aside);
  if (grabbed !== deadPid && grabbed !== null) {
    try { if (!existsSync(path)) renameSync(aside, path); } catch { /* leave it */ }
    return false;
  }
  rmSync(aside, { force: true });
  return true;
}

// exclusive lock holding the owner's pid. a live owner (any age) means skip this run; a dead owner's
// lock is taken over. release deletes the lock only while it still holds our pid.
export function acquireLock(path: string, alive: (pid: number) => boolean = isPidAlive): (() => void) | null {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return () => { if (ownerPid(path) === process.pid) rmSync(path, { force: true }); };
    } catch {
      const owner = ownerPid(path);
      if (owner !== null ? alive(owner) : fresh(path)) return null;
      if (!takeOverDeadLock(path, owner)) return null;
    }
  }
  return null;
}

function fresh(path: string): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs <= UNREADABLE_LOCK_GRACE_MS;
  } catch {
    return false;
  }
}
