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

// legacy comment file; current Review Records live under the user's diffle data directory.
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
export type ReviewActivityType =
  | "review_started"
  | "feedback_returned"
  | "rereview_requested"
  | "comment_replied"
  | "comment_addressed"
  | "comment_resolved"
  | "comment_reopened"
  | "review_approved"
  | "review_cancelled";

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

// new-side git blob shas captured when the reviewer last returned feedback (null = file absent).
// the interdiff ("changed since last review") compares the current content against these.
export interface ReviewRound {
  capturedAt: string;
  blobs: Record<string, string | null>;
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
  lastRound?: ReviewRound;
}

export interface FeedbackBundle {
  reviewId: string;
  target: ReviewTarget;
  summary?: string;
  comments: Comment[];
}

// POST /api/comments — full replace of the comments array
export interface CommentsUpdateRequest {
  comments: Comment[];
}

export interface ViewedUpdateRequest {
  viewed: string[];
}

export interface ReviewOutcomeRequest {
  outcome: "feedback" | "approved" | "cancelled";
  summary?: string;
  acknowledgeUnresolved?: boolean;
}

export interface CommentReplyRequest {
  id: string;
  commentId: string;
  text: string; // author is not sent — the server always authors this reply as the reviewer
}

export interface CommentStatusRequest {
  commentId: string;
  status: ReviewCommentStatus;
}

export interface LegacyReviewRequest {
  action: "import" | "remove" | "ignore";
}

export interface UserState {
  seenVersion?: string; // loupe version whose what's-new highlights the user has dismissed
  updateCheckedAt?: string; // iso time of the last launch-time release check (throttles the notice)
  latestKnownVersion?: string; // newest release seen by that check
}

export interface StateUpdateRequest {
  seenVersion?: string;
}

// GET /api/update — installed version vs the newest published GitHub release
export interface UpdateStatus {
  behind: boolean; // true when a newer published release exists
  current: string; // installed version (build-time constant, or package.json in source)
  latest: string; // highest available release tag (equals current when up to date)
}

// GET /api/compile — the compiled review prompt
export interface CompilePromptResponse {
  prompt: string;
}

// GET /api/file — new-side full text of a repo file, for the markdown preview
export interface FileContentResponse {
  path: string;
  content: string;
}

// ── analysis (deterministic scorecard) ───────────────────────────────────────

// whole-file noise that the ui collapses by default
export type FileNoise = "generated" | "lockfile";

export type ScoreBand = "low" | "medium" | "high"; // green / amber / red

export type FlagKind =
  | "sensitive-path"
  | "public-api-removed"
  | "public-api-added"
  | "dependency"
  | "leftover"
  | "untested"
  | "hotspot"
  | "large";

export interface ChangeFlag {
  kind: FlagKind;
  reason: string; // plain-english, names the rule that fired
  line?: number | null; // new-side line (old-side for removals) when the flag points at one
}

// a block of deleted lines that reappears as added lines (same or another file)
export interface MovedBlock {
  from: { file: string; start: number; end: number }; // old-side lines, inclusive
  to: { file: string; start: number; end: number }; // new-side lines, inclusive
  edited: boolean; // false = moved verbatim (ignoring indentation)
}

export interface FileAnalysis {
  path: string;
  language: string; // adapter id, e.g. "csharp" | "typescript" | "generic"
  group: string; // review group label, e.g. a .csproj name or a top-level folder
  noise: FileNoise | null;
  whitespaceOnlyHunks: number[]; // indices into DiffFile.hunks that only change whitespace
  noiseLines: number; // changed lines inside whitespace-only hunks or moved blocks
  effectiveLines: number; // additions + deletions minus noiseLines (0 when the whole file is noise)
  testPair: string | null; // the paired test (or source) file when it is also in the diff
  isTest: boolean;
  churn: number; // commits touching the file in the churn window, excluding the change itself
  changedSinceReview: boolean | null; // null when there is no previous round to compare
  flags: ChangeFlag[];
}

export interface ScorecardCategory {
  id: "size" | "tests" | "api" | "dependencies" | "hotspots" | "flags";
  label: string;
  band: ScoreBand;
  summary: string; // one line, e.g. "412 effective lines across 9 files"
  reasons: string[]; // the signals behind the band
}

export interface ReviewGroup {
  id: string;
  label: string;
  files: string[]; // paths in suggested review order
}

// GET /api/scorecard
export interface ReviewScorecard {
  totals: { files: number; additions: number; deletions: number; effectiveLines: number; noiseLines: number };
  categories: ScorecardCategory[];
  groups: ReviewGroup[]; // groups in suggested order; together they cover every diff file once
  files: FileAnalysis[]; // flattened in suggested review order
  moved: MovedBlock[];
}

// GET /api/interdiff?path= — what changed in one file since the reviewer's last round
export interface InterdiffResponse {
  path: string;
  file: DiffFile | null; // null when the file is unchanged since the round
}

// error envelope returned with any non-2xx status
export interface ApiError {
  error: string;
}
