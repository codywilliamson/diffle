// `diffle sessions` and `diffle cleanup` — list and reclaim orphaned/finished review servers.

import { classifySessions, stopSession, unregisterSession, type SessionEntry } from "../core/sessions";
import { readReviewRecord } from "../core/reviewRecords";
import { PRODUCT } from "../core/product";
import { confirmProceed } from "./confirm";

const NO_SESSIONS = `no ${PRODUCT.name} sessions`;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function ageOf(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < MINUTE_MS) return "just now";
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)}m`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h`;
  return `${Math.floor(ms / DAY_MS)}d`;
}

function recordStatus(reviewId: string): string {
  return readReviewRecord(reviewId)?.status ?? "missing";
}

function printTable(rows: string[][]): void {
  const widths = rows[0]!.map((_, col) => Math.max(...rows.map((row) => row[col]!.length)));
  for (const row of rows) console.log(row.map((cell, col) => cell.padEnd(widths[col]!)).join("  ").trimEnd());
}

export async function runSessionsCommand(): Promise<void> {
  const { live, stale } = await classifySessions();
  const all = [...live.map((entry) => ({ entry, state: "live" })), ...stale.map((entry) => ({ entry, state: "stale" }))];
  if (all.length === 0) return console.log(NO_SESSIONS);
  printTable([
    ["REVIEW", "STATUS", "HOST", "PORT", "AGE", "STATE"],
    ...all.map(({ entry, state }) => [entry.reviewId, recordStatus(entry.reviewId), entry.host, String(entry.port), ageOf(entry.startedAt), state]),
  ]);
}

interface CleanupOptions { yes: boolean; all: boolean; }
export interface CleanupPlan { toDelete: SessionEntry[]; toStop: SessionEntry[]; }
type Stopper = (entry: SessionEntry) => Promise<boolean>;

// a review with no record, or one already approved/cancelled, has nothing left to review.
function isFinished(entry: SessionEntry): boolean {
  const status = readReviewRecord(entry.reviewId)?.status;
  return status === undefined || status === "approved" || status === "cancelled";
}

// pure: decides what cleanup would do, given already-classified sessions. kept separate from
// classifySessions()/stopSession() so it (and applyCleanupPlan below) can be unit-tested without
// a real registry or server.
export function buildCleanupPlan(live: SessionEntry[], stale: SessionEntry[], opts: CleanupOptions): CleanupPlan {
  return { toDelete: stale, toStop: opts.all ? live : live.filter(isFinished) };
}

// applies the plan; returns the toStop entries whose stopper call failed (still running).
export async function applyCleanupPlan(plan: CleanupPlan, stop: Stopper = stopSession): Promise<SessionEntry[]> {
  for (const entry of plan.toDelete) unregisterSession(entry.sessionId);
  const failed: SessionEntry[] = [];
  for (const entry of plan.toStop) {
    if (!(await stop(entry))) failed.push(entry);
  }
  return failed;
}

export async function runCleanupCommand(opts: CleanupOptions): Promise<void> {
  const { live, stale } = await classifySessions();
  const plan = buildCleanupPlan(live, stale, opts);
  if (plan.toDelete.length === 0 && plan.toStop.length === 0) return console.log(NO_SESSIONS);

  console.log("plan:");
  for (const entry of plan.toDelete) console.log(`  delete stale entry ${entry.reviewId} (${entry.host}, pid ${entry.pid})`);
  for (const entry of plan.toStop) console.log(`  stop ${entry.reviewId} (${entry.host}, port ${entry.port}, ${recordStatus(entry.reviewId)})`);

  if (!(await confirmProceed(opts.yes))) return;

  const failed = await applyCleanupPlan(plan);
  if (failed.length > 0) {
    console.log("failed to stop:");
    for (const entry of failed) console.log(`  ${entry.reviewId} (${entry.host}, port ${entry.port})`);
    process.exit(1);
  }
}
