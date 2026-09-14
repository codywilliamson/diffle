// thin fetch wrappers around the loupe server api. all json.

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error ?? `POST ${url} failed: ${res.status}`);
  }
  return res.json();
}

// DiffResult
export function getDiff() {
  return getJson("/api/diff");
}

// ReviewFile, normalizing the empty {} into a usable shape.
export async function getComments() {
  const data = await getJson("/api/comments");
  if (!data || !data.comments) return { viewed: [], comments: [] };
  return { viewed: data.viewed ?? [], comments: data.comments ?? [] };
}

// Durable Review Record actions. Browser-only actions use the reviewer endpoints;
// agents use the MCP port for replies and addressed status.
export function getReview(id) { return getJson(`/api/review?id=${encodeURIComponent(id)}`); }
export function submitReviewOutcome(id, outcome, summary, acknowledgeUnresolved = false) {
  return postJson("/api/review/outcome", { id, outcome, summary, acknowledgeUnresolved });
}
export function resolveReviewComment(id, commentId, status) {
  return postJson("/api/review/status", { id, commentId, status });
}
export function replyToReviewComment(id, commentId, text) {
  return postJson("/api/review/reply", { id, commentId, text });
}
export function importLegacyReview(id) { return postJson("/api/review/legacy", { action: "import", id }); }
export function removeLegacyReview(confirm = false) { return postJson("/api/review/legacy", { action: "remove", confirm }); }
export function detectLegacyReview() { return getJson("/api/review/legacy"); }

// full replace of the comments array; returns updated ReviewFile.
export function saveComments(comments) {
  return postJson("/api/comments", { comments });
}

// full replace of the viewed array; returns updated ReviewFile.
export function saveViewed(viewed) {
  return postJson("/api/viewed", { viewed });
}

// { prompt: string }
export function compile(summary) {
  const query = summary?.trim() ? `?summary=${encodeURIComponent(summary)}` : "";
  return getJson(`/api/compile${query}`);
}

// UpdateStatus — loupe's release status vs origin
export function getUpdate() {
  return getJson("/api/update");
}

// UserState from ~/.loupe/state.json (persists across launches/ports)
export function getState() {
  return getJson("/api/state");
}

// merges a partial UserState into the stored one; returns the merged UserState
export function saveState(patch) {
  return postJson("/api/state", patch);
}

// { path, content } — new-side full content of a file, for markdown preview.
export function getFile(path) {
  return getJson(`/api/file?path=${encodeURIComponent(path)}`);
}

// url serving a repo file's raw bytes with a media content type (markdown images).
export function rawUrl(path) {
  return `/api/raw?path=${encodeURIComponent(path)}`;
}
