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
  commit?: CommitInfo; // present when the target is a single commit (`nittle show`)
}

// the commit under review, shown above the files
export interface CommitInfo {
  hash: string; // full hash; the review record pins this
  shortHash: string;
  subject: string;
  body: string; // plain text, line breaks preserved
  author: string;
  date: string; // ISO 8601 author date
  isMerge: boolean; // merges are diffed against the first parent
  baseShortHash: string | null; // first parent; null for a root commit (diffed against the empty tree)
}

export interface DiffResult {
  ref: string; // human-readable ref label, e.g. "working tree" or "feature/x → origin/main"
  meta?: DiffMeta; // present from the server; absent in hand-built fixtures
  files: DiffFile[];
}

// ── review / comments ────────────────────────────────────────────────────────

// legacy comment file; current Review Records live under the user's nittle data directory.
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

// a ```suggestion fence in a line or range comment, with the lines it replaces (get_review, --json)
export interface ReviewSuggestion {
  commentId: string;
  path: string;
  side: "old" | "new";
  startLine: number;
  endLine: number;
  original: string[]; // the anchored lines as currently in the diff
  suggested: string[]; // the replacement lines; an empty array means delete the original lines
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

// where an unfinished diffle -> nittle install migration found the diffle install and put nittle, so a
// retry works without the one-shot NITTLE_LEGACY_INSTALL_DIR / NITTLE_INSTALL_DIR values
export interface MigrationRecord {
  legacyDir: string;
  installDir: string;
}

export interface UserState {
  seenVersion?: string; // nittle version whose what's-new highlights the user has dismissed
  updateCheckedAt?: string; // iso time of the last launch-time release check (throttles the notice)
  latestKnownVersion?: string; // newest release seen by that check
  legacyEnvNoticed?: string; // the DIFFLE_* rename notice already shown, keyed by the sorted var set
  legacyPathChecked?: boolean; // the one-time look for a stale diffle PATH entry after its bin dir was gone is done
  migration?: MigrationRecord; // an install migration that still has work left; cleared once it completes
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

export type SearchSide = "old" | "new";

// smart = insensitive unless the query has an uppercase letter
export type SearchCase = "smart" | "sensitive" | "insensitive";

// one matching line from GET /api/search
export interface SearchHit {
  path: string; // old path for old-side hits (renames), new path for new-side hits
  side: SearchSide;
  line: number; // 1-based line in that side's file
  preview: string; // the line without its line ending, cut to a window around the first match when long
  ranges: [number, number][]; // [start, end) match spans in JS string code units, relative to `preview`
}

// GET /api/search?q=&regex=0|1&case=smart|sensitive|insensitive
export interface SearchResponse {
  results: SearchHit[];
  truncated: boolean; // a cap (result count, file size, line length, time) cut the search short
}

// error envelope returned with any non-2xx status
export interface ApiError {
  error: string;
}

// GET /api/lsp/status — language servers for the languages present in the diff
export type LspLanguage = "typescript" | "csharp";
// idle = installed but not started yet (servers start on the first navigation request)
export type LspState = "missing" | "idle" | "starting" | "indexing" | "ready" | "failed";

export interface LspLanguageStatus {
  language: LspLanguage;
  state: LspState;
  restarts: number;
  server?: string; // resolved executable
  hint?: string; // how to install it, when missing
  stderr?: string; // bounded stderr tail, when the server failed or crashed
}

export interface LspStatusResponse {
  enabled: boolean; // false under --no-lsp
  languages: LspLanguageStatus[];
}

// ── lsp navigation ───────────────────────────────────────────────────────────
// POST /api/lsp/{definition,hover,references}, GET /api/lsp/{symbols,file}. the client speaks
// diff coordinates: line is 1-based, character is a 0-based js string (utf-16) offset. the server
// converts to and from whatever encoding the language server negotiated.

export type LspSide = "old" | "new";

export interface LspPosition { line: number; character: number }
export interface LspRange { start: LspPosition; end: LspPosition }

export interface LspPositionRequest {
  path: string; // repo-relative
  side: LspSide; // only "new" is served until the detached worktree lands
  line: number;
  character: number;
}

export type LspDefinitionKind = "definition" | "typeDefinition";
export interface LspDefinitionRequest extends LspPositionRequest { kind?: LspDefinitionKind }

export type LspErrorCode =
  | "server-unavailable" // 409: missing, failed or disabled; state + hint say why
  | "old-side-unsupported" // 409: old-side navigation needs the detached worktree (#186)
  | "invalid-request" // 400
  | "file-not-found" // 404
  | "forbidden" // 403: /api/lsp/file only serves paths the server returned as targets
  | "cancelled" // 499: superseded or aborted
  | "stale" // 409: the file changed under the request twice; retry
  | "request-failed"; // 502: the server answered with an error

export interface LspErrorResponse extends ApiError {
  code: LspErrorCode;
  state?: LspState;
  hint?: string;
  stderr?: string;
}

export interface LspLocation {
  uri: string;
  path: string | null; // repo-relative, null outside the repo
  absolutePath: string;
  inRepo: boolean;
  inDiff: boolean; // the file is part of the current diff
}

export interface LspTarget extends LspLocation { range: LspRange }

export interface LspDefinitionResponse {
  targets: LspTarget[];
  onDefinition: boolean; // the request sits on the definition itself; the client shows references instead
}

export interface LspHoverResponse {
  contents: string; // markdown; empty when the server has nothing
  range?: LspRange;
}

export interface LspReference {
  range: LspRange;
  contextStartLine: number; // 1-based line of contextLines[0]
  contextLines: string[];
}

export interface LspReferenceFile extends LspLocation {
  changed: boolean; // same as inDiff; kept explicit for the badge
  references: LspReference[];
}

export interface LspReferencesResponse {
  files: LspReferenceFile[]; // files in the diff first
  total: number; // before the cap
  truncated: boolean;
}

export interface LspSymbol {
  name: string;
  kind: string; // "class" | "method" | "function" ...
  detail?: string;
  range: LspRange;
  selectionRange: LspRange;
  changed: boolean; // overlaps a changed line of the diff
  children: LspSymbol[];
}

export interface LspDocumentSymbolsResponse { path: string; symbols: LspSymbol[] }

export interface LspWorkspaceSymbol extends LspLocation {
  name: string;
  kind: string;
  containerName?: string;
  range: LspRange;
}

export interface LspWorkspaceSymbolsResponse { symbols: LspWorkspaceSymbol[]; total: number; truncated: boolean }

export interface LspFileResponse extends LspLocation { content: string }
