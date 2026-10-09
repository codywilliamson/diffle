import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { dataDir } from "./dataDir";
import {
  REVIEW_FILE,
  REVIEW_SCHEMA_VERSION,
  type Comment,
  type CommentReply,
  type ReviewActivity,
  type ReviewCommentStatus,
  type ReviewFile,
  type ReviewOrigin,
  type ReviewPolicy,
  type ReviewRecord,
  type ReviewStatus,
  type ReviewTarget,
} from "../types";

export interface ReviewRecordInput {
  target: ReviewTarget;
  policy?: ReviewPolicy;
  origin?: ReviewOrigin;
  summary?: string;
  viewed?: string[];
  comments?: Comment[];
}
export type ReviewRecordPatch = Partial<Pick<ReviewRecord, "summary" | "viewed" | "comments" | "origin" | "target" | "policy" | "lastRound">>;
export type ReviewRecordUpdater = ReviewRecordPatch | ((record: ReviewRecord) => ReviewRecordPatch);

const root = () => join(dataDir(), "reviews");
const pathFor = (id: string) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) throw new Error("invalid review id");
  return join(root(), id, "review.json");
};
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
// keeps updatedAt strictly increasing even when two mutations land in the same millisecond,
// so clients that skip on `updatedAt <=` never get stuck missing the second one.
function touch(record: ReviewRecord): void {
  const next = now();
  record.updatedAt = next > record.updatedAt ? next : new Date(new Date(record.updatedAt).getTime() + 1).toISOString();
}

function activity(type: ReviewActivity["type"], actor: ReviewActivity["actor"], commentId?: string, summary?: string): ReviewActivity {
  return { id: randomUUID(), type, actor, createdAt: now(), ...(commentId ? { commentId } : {}), ...(summary ? { summary } : {}) };
}
function readAt(path: string): ReviewRecord | null {
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as ReviewRecord;
    if (record.schemaVersion !== REVIEW_SCHEMA_VERSION || !record.id || !record.target?.cwd) return null;
    return record;
  } catch { return null; }
}
function save(record: ReviewRecord): void {
  const dir = join(root(), record.id);
  mkdirSync(dir, { recursive: true });
  const temp = join(dir, `.review-${randomUUID()}.tmp`);
  writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  renameSync(temp, pathFor(record.id));
}
function requireRecord(id: string): ReviewRecord {
  const record = readAt(pathFor(id));
  if (!record) throw new Error("review record not found");
  return record;
}
function assertActive(record: ReviewRecord, allowApproved = false): void {
  if (allowApproved && record.status === "approved") return;
  if (record.status === "approved" || record.status === "cancelled") throw new Error("review record is terminal");
}

export function createReviewRecord(input: ReviewRecordInput): ReviewRecord {
  const createdAt = now();
  const record: ReviewRecord = {
    schemaVersion: REVIEW_SCHEMA_VERSION, id: randomUUID(), target: { ...input.target, cwd: resolve(input.target.cwd) },
    ...(input.origin ? { origin: clone(input.origin) } : {}), policy: input.policy ?? "required", status: "awaiting_human",
    ...(input.summary ? { summary: input.summary } : {}), createdAt, updatedAt: createdAt,
    viewed: [...(input.viewed ?? [])], comments: clone(input.comments ?? []), activity: [activity("review_started", "system")],
  };
  save(record); return clone(record);
}

export function readReviewRecord(id: string): ReviewRecord | null { return clone(readAt(pathFor(id))); }

function matchesOrigin(record: ReviewRecord, origin: ReviewOrigin): boolean {
  if (!origin.agent || record.origin?.agent !== origin.agent) return false;
  if (origin.sessionId) return record.origin?.sessionId === origin.sessionId;
  return !!origin.taskId && record.origin?.taskId === origin.taskId;
}

export function findActiveReview(cwd: string, origin?: ReviewOrigin): ReviewRecord | null {
  if (!existsSync(root())) return null;
  const target = resolve(cwd);
  const records = readdirSync(root(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => readAt(join(root(), entry.name, "review.json")))
    .filter((record): record is ReviewRecord => !!record && resolve(record.target.cwd) === target)
    .filter((record) => record.status !== "approved" && record.status !== "cancelled")
    .filter((record) => !origin || matchesOrigin(record, origin))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return records[0] ? clone(records[0]) : null;
}

export function findActiveReviewForOrigin(cwd: string, origin: ReviewOrigin): ReviewRecord | null {
  if (!origin.agent || (!origin.sessionId && !origin.taskId)) return null;
  return findActiveReview(cwd, origin);
}

export function updateReviewRecord(id: string, updater: ReviewRecordUpdater): ReviewRecord {
  const record = requireRecord(id); assertActive(record);
  const patch = typeof updater === "function" ? updater(clone(record)) : updater;
  Object.assign(record, clone(patch)); touch(record);
  save(record); return clone(record);
}

function transition(id: string, status: ReviewStatus, type: ReviewActivity["type"], actor: ReviewActivity["actor"], summary?: string, allowApproved?: boolean): ReviewRecord {
  const record = requireRecord(id); assertActive(record, allowApproved);
  record.status = status; if (summary !== undefined && actor === "reviewer") record.summary = summary;
  record.activity.push(activity(type, actor, undefined, summary)); touch(record); save(record); return clone(record);
}
export function returnFeedback(id: string, summary?: string): ReviewRecord {
  const record = requireRecord(id); assertActive(record);
  if (record.status !== "awaiting_human") throw new Error("feedback requires a review awaiting the reviewer");
  const unresolved = record.comments.some((comment) => (comment.status ?? (comment.resolved ? "resolved" : "open")) !== "resolved");
  const note = summary?.trim();
  if (!unresolved && !note) throw new Error("returning feedback requires an unresolved comment or a summary");
  return transition(id, "feedback_ready", "feedback_returned", "reviewer", note);
}
export function requestRereview(id: string, summary?: string): ReviewRecord {
  const record = requireRecord(id);
  if (record.status !== "feedback_ready" && record.status !== "approved") {
    assertActive(record); // cancelled -> "review record is terminal"
    throw new Error("rereview requires returned feedback");
  }
  return transition(id, "awaiting_human", "rereview_requested", "agent", summary, record.status === "approved");
}
export const cancelReview = (id: string, summary?: string) => transition(id, "cancelled", "review_cancelled", "reviewer", summary);

export function approveReview(id: string, acknowledgeUnresolved = false): ReviewRecord {
  const record = requireRecord(id); assertActive(record);
  if (record.status !== "awaiting_human") throw new Error("approval requires a review awaiting the reviewer");
  const unresolved = record.comments.some((comment) => (comment.status ?? (comment.resolved ? "resolved" : "open")) !== "resolved");
  if (unresolved && !acknowledgeUnresolved) throw new Error("approval requires acknowledging unresolved comments");
  record.status = "approved"; record.activity.push(activity("review_approved", "reviewer")); touch(record); save(record); return clone(record);
}

export function replyToComment(id: string, commentId: string, text: string, author: "agent" | "reviewer"): ReviewRecord {
  const record = requireRecord(id); assertActive(record);
  const comment = record.comments.find((item) => item.id === commentId); if (!comment) throw new Error("comment not found");
  const reply: CommentReply = { id: randomUUID(), author, text, createdAt: now() };
  comment.replies = [...(comment.replies ?? []), reply]; record.activity.push(activity("comment_replied", author, commentId));
  touch(record); save(record); return clone(record);
}
export function markCommentAddressed(id: string, commentId: string): ReviewRecord {
  const record = requireRecord(id); assertActive(record); const comment = record.comments.find((item) => item.id === commentId);
  if (!comment) throw new Error("comment not found");
  if ((comment.status ?? (comment.resolved ? "resolved" : "open")) === "resolved") throw new Error("resolved comments must be reopened by the reviewer");
  comment.status = "addressed"; comment.resolved = false;
  record.activity.push(activity("comment_addressed", "agent", commentId)); touch(record); save(record); return clone(record);
}
export function setCommentStatus(id: string, commentId: string, status: ReviewCommentStatus, actor: "agent" | "reviewer"): ReviewRecord {
  const record = requireRecord(id); assertActive(record); const comment = record.comments.find((item) => item.id === commentId);
  if (!comment) throw new Error("comment not found");
  if (actor === "agent" && status !== "addressed") throw new Error("only the reviewer may resolve or reopen comments");
  comment.status = status; comment.resolved = status === "resolved"; const type = status === "resolved" ? "comment_resolved" : status === "open" ? "comment_reopened" : "comment_addressed";
  record.activity.push(activity(type, actor, commentId)); touch(record); save(record); return clone(record);
}

export function detectLegacyReview(cwd: string): boolean { return existsSync(join(resolve(cwd), REVIEW_FILE)); }
export function importLegacyReview(id: string, cwd: string): ReviewRecord {
  pathFor(id);
  const legacyPath = join(resolve(cwd), REVIEW_FILE); if (!existsSync(legacyPath)) throw new Error("legacy review not found");
  const legacy = JSON.parse(readFileSync(legacyPath, "utf8")) as ReviewFile;
  const comments = legacy.comments.map((comment) => {
    const status = comment.status ?? (comment.resolved ? "resolved" : "open");
    return { ...comment, status, resolved: status === "resolved" };
  });
  const existing = readAt(pathFor(id));
  if (existing) {
    assertActive(existing); existing.comments = comments; existing.viewed = [...legacy.viewed]; touch(existing);
    save(existing); return clone(existing);
  }
  const createdAt = legacy.meta.createdAt || now();
  const record: ReviewRecord = {
    schemaVersion: REVIEW_SCHEMA_VERSION, id, target: { cwd: resolve(cwd), ref: legacy.meta.ref },
    policy: "required", status: "awaiting_human", createdAt, updatedAt: legacy.meta.updatedAt || createdAt,
    viewed: [...legacy.viewed], comments, activity: [activity("review_started", "system")],
  };
  save(record); return clone(record);
}
export function removeLegacyReview(cwd: string): boolean {
  const path = join(resolve(cwd), REVIEW_FILE); if (!existsSync(path)) return false; rmSync(path); return true;
}
