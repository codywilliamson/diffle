// file-content routes: new-side text for previews, raw bytes for media a markdown file
// embeds, and the static client assets. every path is checked against traversal.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, extname, resolve, posix, win32 } from "node:path";
import type { ServerContext } from "./handlers";
import type { FileContentResponse } from "../types";
import { runGitBytes } from "../utils/git";
import { apiError, json } from "./respond";

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm",
};

function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

// true when the absolute `target` sits at or below the absolute `base`.
function containsPath(base: string, target: string): boolean {
  return target === base || target.startsWith(base + "\\") || target.startsWith(base + "/");
}

// true when `rel` resolves inside `root` (defense in depth beyond the ".." check).
function insideDir(root: string, rel: string): boolean {
  const base = resolve(root);
  return containsPath(base, resolve(base, rel));
}

// absolute on either platform's rules, so a drive-letter path is refused on posix hosts too.
const isAbsolutePath = (path: string) => posix.isAbsolute(path) || win32.isAbsolute(path);

// the repo-relative ?path= query, or null when missing or escaping the repo.
function repoPath(ctx: ServerContext, url: URL): string | null {
  const path = url.searchParams.get("path");
  if (!path || path.includes("..") || isAbsolutePath(path) || !insideDir(ctx.cwd, path)) return null;
  return path;
}

// working-tree bytes, refusing a symlink that points outside the repo (throws → 404).
function readWorkingTree(cwd: string, path: string): Buffer {
  const real = realpathSync(join(cwd, path));
  if (!containsPath(realpathSync(cwd), real)) throw new Error("outside repo");
  return readFileSync(real);
}

// new-side bytes of a repo file: working tree reads disk, other modes `git show <ref>:<path>`.
function readNewSide(ctx: ServerContext, path: string): Buffer {
  return ctx.newRef === null ? readWorkingTree(ctx.cwd, path) : runGitBytes(["show", `${ctx.newRef}:${path}`], ctx.cwd);
}

// { path, content } — the full text of a file, for the markdown preview.
export function handleGetFile(ctx: ServerContext, url: URL): Response {
  const path = repoPath(ctx, url);
  if (!path) return apiError("invalid path", 400);
  try {
    return json({ path, content: readNewSide(ctx, path).toString("utf8") } satisfies FileContentResponse);
  } catch {
    return apiError("file not found", 404);
  }
}

// raw bytes with a media content type — images and video a markdown preview references.
export function handleGetRaw(ctx: ServerContext, url: URL): Response {
  const path = repoPath(ctx, url);
  if (!path) return apiError("invalid path", 400);
  try {
    return new Response(readNewSide(ctx, path), { headers: { "Content-Type": contentTypeFor(path) } });
  } catch {
    return apiError("file not found", 404);
  }
}

// serve a static asset from clientDir.
export function serveStatic(ctx: ServerContext, pathname: string): Response {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (rel.includes("..") || !insideDir(ctx.clientDir, rel)) return apiError("not found", 404);
  const filePath = resolve(ctx.clientDir, rel);
  if (!existsSync(filePath)) return apiError("not found", 404);
  return new Response(readFileSync(filePath), { headers: { "Content-Type": contentTypeFor(filePath) } });
}

export function notFound(): Response {
  return apiError("not found", 404);
}
