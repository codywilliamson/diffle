// small shared helpers used across components. no preact, no dom.

const BADGE = { added: "A", modified: "M", deleted: "D", renamed: "R" };
export function changeBadge(t) {
  return BADGE[t] ?? "?";
}

// "+N -N" aggregate across files.
export function totalDelta(files) {
  let add = 0;
  let del = 0;
  for (const f of files) {
    add += f.additions;
    del += f.deletions;
  }
  return { add, del };
}

// relative timestamp like "5m ago", "2h ago", "3d ago", else a date.
const UNITS = [
  ["y", 31536000],
  ["mo", 2592000],
  ["d", 86400],
  ["h", 3600],
  ["m", 60],
];
export function relativeTime(iso) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return "just now";
  for (const [label, span] of UNITS) {
    const n = Math.floor(secs / span);
    if (n >= 1) return `${n}${label} ago`;
  }
  return "just now";
}

// map a file extension to a highlight.js language hint.
const LANGS = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", json: "json", css: "css",
  scss: "scss", less: "less", html: "xml", xml: "xml", svg: "xml",
  md: "markdown", py: "python", rb: "ruby", go: "go", rs: "rust",
  java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp",
  php: "php", sh: "bash", bash: "bash", zsh: "bash", yml: "yaml",
  yaml: "yaml", sql: "sql", swift: "swift", kt: "kotlin", toml: "ini",
  ps1: "powershell", psm1: "powershell", psd1: "powershell", markdown: "markdown",
};
export function langFor(path) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGS[ext] ?? null;
}

// true for files we render as markdown by default.
export function isMarkdown(path) {
  return /\.(md|markdown)$/i.test(path);
}

// resolves a link or image target written inside `fromFile` to a repo-relative path,
// collapsing "./" and "../"; a leading "/" means the repo root (github's convention).
export function resolveRepoPath(fromFile, target) {
  const parts = target.startsWith("/") ? [] : fromFile.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

// clamps n into [lo, hi].
export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// diff rows render at line-height 1.5 * 12px; used to size lazy placeholders.
export const ROW_HEIGHT = 18;

export function lineCountOf(file) {
  let n = 0;
  for (const h of file.hunks) n += h.lines.length;
  return n;
}

// placeholder height for an unmounted file body: one row per line + one per hunk header.
export function estimatedHeight(file) {
  return Math.max((lineCountOf(file) + file.hunks.length) * ROW_HEIGHT, ROW_HEIGHT);
}

// group files into a nested tree by directory segments.
// returns { name, path, dirs: Map<name,node>, files: DiffFile[] }.
export function buildTree(files) {
  const root = { name: "", path: "", dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    const name = parts.pop();
    let node = root;
    let acc = "";
    for (const seg of parts) {
      acc = acc ? `${acc}/${seg}` : seg;
      if (!node.dirs.has(seg)) {
        node.dirs.set(seg, { name: seg, path: acc, dirs: new Map(), files: [] });
      }
      node = node.dirs.get(seg);
    }
    node.files.push({ ...file, name });
  }
  return root;
}

// stable dom id for a file section, so the tree can scroll to it.
export function fileAnchorId(path) {
  return "file-" + path.replace(/[^a-zA-Z0-9]/g, "-");
}

// ── staleness — mirror of src/core/anchor.ts (the buildless client can't import the ts core) ──

const sideOf = (c) => c.side ?? "new";
const numOn = (l, side) => (side === "old" ? l.oldLine : l.newLine);
const rangeEnd = (c) => (c.endLine != null ? Math.max(c.line, c.endLine) : c.line);

// a comment is anchored if its file is in the diff and (for line comments) some hunk line
// on its side still carries a number within [line, endLine]; file-level is anchored iff
// the file is present. a range counts as anchored when ANY line in it survives.
export function isAnchored(comment, diff) {
  const file = diff.files.find((f) => f.path === comment.file);
  if (!file) return false;
  if (comment.line == null) return true;
  const side = sideOf(comment);
  const start = comment.line;
  const end = rangeEnd(comment);
  return file.hunks.some((h) =>
    h.lines.some((l) => {
      const n = numOn(l, side);
      return n != null && n >= start && n <= end;
    })
  );
}

// splits comments into those still anchored in the diff and those orphaned, preserving order.
export function partitionComments(comments, diff) {
  const anchored = [];
  const stale = [];
  for (const c of comments) (isAnchored(c, diff) ? anchored : stale).push(c);
  return { anchored, stale };
}
