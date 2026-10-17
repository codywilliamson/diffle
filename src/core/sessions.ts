// session registry: one json file per running nittle server, under <data dir>/sessions/<session-id>.json.
// keyed by session id (not review id) so two launches of the same review can coexist as separate
// entries. lets `nittle sessions`/`cleanup` and the MCP process discover and stop servers they
// didn't launch directly.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { dataDir } from "./dataDir";

export type SessionHost = "cli" | "mcp" | "hook";
const VALID_HOSTS: readonly string[] = ["cli", "mcp", "hook"];

export interface SessionEntry {
  sessionId: string;
  reviewId: string;
  pid: number;
  port: number;
  url: string; // server origin only, e.g. http://localhost:5173 — no /?review= path
  cwd: string;
  host: SessionHost;
  startedAt: string; // ISO 8601
}

const PROBE_TIMEOUT_MS = 1500;
const JSON_EXT = ".json";

const sessionsDir = () => join(dataDir(), "sessions");
const pathFor = (sessionId: string) => join(sessionsDir(), `${sessionId}${JSON_EXT}`);

export function registerSession(entry: SessionEntry): void {
  mkdirSync(sessionsDir(), { recursive: true });
  const temp = join(sessionsDir(), `.session-${randomUUID()}.tmp`);
  writeFileSync(temp, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  renameSync(temp, pathFor(entry.sessionId));
}

export function unregisterSession(sessionId: string): void {
  const path = pathFor(sessionId);
  if (existsSync(path)) rmSync(path);
}

// every field present with the right type, port/pid integers, host one of the three values, and
// the filename stem equal to the entry's own sessionId — so any deletion keyed off a validated
// entry's sessionId can only ever land on the exact file it came from.
function isValidEntry(raw: unknown, filenameStem: string): raw is SessionEntry {
  if (!raw || typeof raw !== "object") return false;
  const e = raw as Record<string, unknown>;
  return (
    typeof e.sessionId === "string" && e.sessionId === filenameStem &&
    typeof e.reviewId === "string" && e.reviewId.length > 0 &&
    typeof e.pid === "number" && Number.isInteger(e.pid) &&
    typeof e.port === "number" && Number.isInteger(e.port) &&
    typeof e.url === "string" && e.url.length > 0 &&
    typeof e.cwd === "string" && e.cwd.length > 0 &&
    typeof e.host === "string" && VALID_HOSTS.includes(e.host) &&
    typeof e.startedAt === "string" && e.startedAt.length > 0
  );
}

export function listSessions(): SessionEntry[] {
  if (!existsSync(sessionsDir())) return [];
  const entries: SessionEntry[] = [];
  for (const name of readdirSync(sessionsDir())) {
    if (!name.endsWith(JSON_EXT)) continue;
    const stem = name.slice(0, -JSON_EXT.length);
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(sessionsDir(), name), "utf8"));
      if (isValidEntry(parsed, stem)) entries.push(parsed);
    } catch { /* skip unparseable files */ }
  }
  return entries;
}

// a reused pid still counts as dead-session unless the http probe below also matches.
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// liveness requires the pid alive AND the server itself answering for this exact review id
// (guards against a reused pid pointing at an unrelated process).
export async function probeSession(entry: SessionEntry): Promise<boolean> {
  try {
    const response = await fetch(`${entry.url}/api/review?id=${encodeURIComponent(entry.reviewId)}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.status !== 200) return false;
    const body = (await response.json()) as { id?: string };
    return body.id === entry.reviewId;
  } catch {
    return false;
  }
}

export async function classifySessions(): Promise<{ live: SessionEntry[]; stale: SessionEntry[] }> {
  const entries = listSessions();
  const checked = await Promise.all(entries.map(async (entry) => {
    const alive = isPidAlive(entry.pid) && (await probeSession(entry));
    return { entry, alive };
  }));
  const live = checked.filter((c) => c.alive).map((c) => c.entry);
  const stale = checked.filter((c) => !c.alive).map((c) => c.entry);
  return { live, stale };
}

export async function stopSession(entry: SessionEntry): Promise<boolean> {
  try {
    const response = await fetch(`${entry.url}/api/session/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: entry.sessionId }),
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
