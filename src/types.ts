// shared contracts — the single source of truth for diff JSON, the .review file,
// and every API request/response body. nothing downstream redefines these shapes.

// ── diff ────────────────────────────────────────────────────────────────────

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

export type LineType = "context" | "addition" | "deletion";

export interface DiffLine {
  type: LineType;
  oldLine: number | null; // null on additions
  newLine: number | null; // null on deletions
  content: string; // line text without the leading +/-/space marker
}

export interface DiffHunk {
  header: string; // e.g. "@@ -38,7 +38,9 @@"
  section?: string; // optional symbol text after the closing @@
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  oldPath: string | null; // prior path for renames, else null
  changeType: ChangeType;
  additions: number;
  deletions: number;
  binary?: boolean; // true for binary files; hunks is then empty
  hunks: DiffHunk[];
}

// structured review context for the top bar (repo + what's being compared)
export interface DiffMeta {
  repo: string; // "owner/repo" from the git remote, else the folder name
  mode: string; // "working tree" | "staged" | "branch" | "range"
  source: string; // the "new" side label, e.g. "working tree" or "feature/x"
  target: string; // the "base" side label, e.g. "main"
}

export interface DiffResult {
  ref: string; // human-readable ref label, e.g. "working tree" or "feature/x → origin/main"
  meta?: DiffMeta; // present from the server; absent in hand-built fixtures
  files: DiffFile[];
}

// ── review / comments ────────────────────────────────────────────────────────

// legacy comment file; current Review Records live under the user's Loupe data directory.
export const REVIEW_FILE = ".review";

// optional severity/intent label; the compiled prompt prefixes the text with [tag]
export type CommentTag = "nit" | "issue" | "question" | "praise";

export type ReviewCommentStatus = "open" | "addressed" | "resolved";

export interface CommentReply {
  id: string;
  author: "agent" | "reviewer";
  text: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  file: string;
  side?: "old" | "new"; // which side `line` counts on; defaults to "new" (old = removed lines)
  line: number | null; // line number on `side` (range START), or null for a file-level comment
  endLine?: number | null; // inclusive end of a multi-line range; absent/null/equal-to-line ⇒ single line
  lineContent: string | null; // raw diff line (with marker) the comment targets, null when file-level
  text: string;
  tag?: CommentTag; // absent = untagged
  status?: ReviewCommentStatus;
  replies?: CommentReply[];
  resolved?: boolean; // true = kept for the record but excluded from the compiled prompt + open counts
  createdAt: string; // ISO 8601
}

export interface ReviewMeta {
  ref: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
export interface ReviewFile {
  meta: ReviewMeta;
  viewed: string[]; // file paths marked viewed
  comments: Comment[];
}

export const REVIEW_SCHEMA_VERSION = 1;
export type ReviewStatus = "awaiting_human" | "feedback_ready" | "approved" | "cancelled";
export type ReviewPolicy = "required" | "handoff" | "off";
export type ReviewActivityType = "review_started" | "feedback_returned" | "rereview_requested"
  | "comment_replied" | "comment_addressed" | "comment_resolved" | "comment_reopened"
  | "review_approved" | "review_cancelled";

export interface ReviewTarget {
  cwd: string;
  ref: string;
  spec?: string;
  meta?: DiffMeta;
}

export interface ReviewOrigin {
  agent?: "codex" | "claude-code";
  sessionId?: string;
  taskId?: string;
  originalRequest?: string;
  summary?: string;
}

export interface ReviewActivity {
  id: string;
  type: ReviewActivityType;
  actor: "agent" | "reviewer" | "system";
  createdAt: string;
  commentId?: string;
  summary?: string;
}

export interface ReviewRecord {
  schemaVersion: typeof REVIEW_SCHEMA_VERSION;
  id: string;
  target: ReviewTarget;
  origin?: ReviewOrigin;
  policy: ReviewPolicy;
  status: ReviewStatus;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  viewed: string[];
  comments: Comment[];
  activity: ReviewActivity[];
}

export interface FeedbackBundle {
  reviewId: string;
  target: ReviewTarget;
  summary?: string;
  comments: Comment[];
}

// POST /api/comments — full replace of the comments array
export interface CommentsUpdateRequest { comments: Comment[]; }
export interface ViewedUpdateRequest { viewed: string[]; }

export interface ReviewOutcomeRequest { outcome: "feedback" | "approved" | "cancelled"; summary?: string; acknowledgeUnresolved?: boolean; }
export interface CommentReplyRequest { id: string; commentId: string; text: string; }
export interface CommentStatusRequest { commentId: string; status: ReviewCommentStatus; }
export interface LegacyReviewRequest { action: "import" | "remove" | "ignore"; }
export type RadarMode = "off" | "local" | "jev";
export interface UserState { seenVersion?: string; radarMode?: RadarMode; }
export interface StateUpdateRequest { seenVersion?: string; radarMode?: RadarMode; }

// GET /api/update — loupe's own release status vs its git origin
export interface UpdateStatus {
  behind: boolean; // true when a newer release tag exists on origin
  current: string; // installed version (loupe's package.json)
  latest: string; // highest available release tag (equals current when up to date)
  repoPath: string; // loupe's install dir, for the "cd … && git pull" hint
}

// error envelope returned with any non-2xx status
export interface ApiError { error: string; }

// ── radar ───────────────────────────────────────────────────────────────────

export type RadarLane = "blocker" | "verified" | "boundary" | "attention" | "routine" | "noise";
export type RadarStatus = "off" | "ready" | "cached" | "partial" | "failure";
export type RadarSufficiency = "sufficient" | "partial" | "insufficient";
export interface RadarDistribution { name: string; pct: number; }
export interface RadarPacketSummary { paths: string[]; bytes: number; lines: number; redactions: number; exclusions: string[]; }
export interface RadarEvidence {
  source: "git" | "path-rule" | "syntax" | "secret-scan";
  kind: string;
  level: "info" | "attention" | "warning" | "error";
  message: string;
  line: number | null;
}
export interface RadarUnit {
  id: string; file: string; hunk: number; line: number; side: "old" | "new"; lane: RadarLane;
  title: string; chip: string; attention: number | null; remote: boolean; stale?: boolean; providerStatus?: "ready" | "failed";
  summary: string; blockedReason?: string; provenance: string[];
  distributions: RadarDistribution[] | null; sufficiency: RadarSufficiency;
  context: { lines: number; complete: boolean }; truncation: boolean; redaction: boolean;
  cache: { state: "live" | "cached" | "n/a"; ms: number }; packet: RadarPacketSummary;
}
export interface RadarMeta {
  generatedAt: string; provider: "local" | "openrouter" | "cloudflare";
  model: string; questionSet: string; totalUnits: number;
}
export interface RadarAnalysis { status: RadarStatus; meta?: RadarMeta; units: RadarUnit[]; error?: string; }
export interface RadarPacket {
  schemaVersion: 1; questionSetVersion: "radar-q1"; model: string;
  file: { path: string; oldPath: string | null; language: string | null; changeType: ChangeType; additions: number; deletions: number };
  unit: { id: string; hunk: number; line: number; side: "old" | "new"; patch: string;
    contextTruncated: boolean; evidence: RadarEvidence[] };
}
