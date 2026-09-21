import type { ChangeType } from "$types";

// letter + label + D5 token classes for a file's change kind, used by the index badge.
const BADGE: Record<ChangeType, { letter: string; label: string; cls: string }> = {
  added: { letter: "A", label: "Added", cls: "bg-add-gutter text-add-text" },
  modified: { letter: "M", label: "Modified", cls: "bg-mod-badge-bg text-mod-badge-text" },
  deleted: { letter: "D", label: "Deleted", cls: "bg-del-gutter text-del-text" },
  renamed: { letter: "R", label: "Renamed", cls: "bg-ren-badge-bg text-ren-badge-text" },
};

export function changeBadge(type: ChangeType): { letter: string; label: string; cls: string } {
  return BADGE[type] ?? { letter: "?", label: "Unknown", cls: "bg-surface-2 text-muted" };
}

// file extension → highlight.js language hint.
const LANGS: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript",
  cjs: "javascript", json: "json", css: "css", scss: "scss", less: "less", html: "xml", xml: "xml",
  svg: "xml", svelte: "xml", md: "markdown", markdown: "markdown", py: "python", rb: "ruby", go: "go",
  rs: "rust", java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp", php: "php", sh: "bash",
  bash: "bash", zsh: "bash", yml: "yaml", yaml: "yaml", sql: "sql", swift: "swift", kt: "kotlin",
  toml: "ini", ps1: "powershell", psm1: "powershell", psd1: "powershell",
};

export function langFor(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGS[ext] ?? null;
}

// files rendered as markdown by default.
export function isMarkdown(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

// resolve a link/image target written inside `fromFile` to a repo-relative path, collapsing
// ./ and ../; a leading "/" means the repo root (github's convention).
export function resolveRepoPath(fromFile: string, target: string): string {
  const parts = target.startsWith("/") ? [] : fromFile.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

// relative timestamp like "5m ago", "2h ago", "3d ago".
const UNITS: [string, number][] = [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]];
export function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return "just now";
  for (const [label, span] of UNITS) {
    const n = Math.floor(secs / span);
    if (n >= 1) return `${n}${label} ago`;
  }
  return "just now";
}
