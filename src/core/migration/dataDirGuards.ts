// safety checks around the data dir move: never operate on aliased trees, never move data out from
// under a live legacy writer, and never run two migrations at once.

import { closeSync, existsSync, openSync, realpathSync, rmSync, statSync, writeSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { listLegacyMcpProcesses } from "../mcpProcesses";
import { isPidAlive, listSessionsIn } from "../sessions";

export const LOCK_NAME = ".nittle.migrating.lock";
export const LOCK_STALE_MS = 5 * 60 * 1000;

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
// and sessions registered in those dirs whose pid is alive.
export type WriterCheck = (legacyDirs: string[]) => string[];
export const findLiveLegacyWriters: WriterCheck = (legacyDirs) => {
  const found: string[] = [];
  try {
    for (const proc of listLegacyMcpProcesses()) found.push(`mcp server pid ${proc.pid}`);
  } catch { /* process table unreadable: do not block on it */ }
  for (const dir of legacyDirs) {
    for (const s of listSessionsIn(dir)) {
      if (s.pid !== process.pid && isPidAlive(s.pid)) found.push(`review session ${s.sessionId} (pid ${s.pid})`);
    }
  }
  return found;
};

// exclusive lock file; a lock older than LOCK_STALE_MS is a crashed run and is taken over.
export function acquireLock(path: string, now = Date.now()): (() => void) | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return () => rmSync(path, { force: true });
    } catch {
      try {
        if (now - statSync(path).mtimeMs <= LOCK_STALE_MS) return null;
        rmSync(path, { force: true });
      } catch { /* lock vanished between calls: retry */ }
    }
  }
  return null;
}
