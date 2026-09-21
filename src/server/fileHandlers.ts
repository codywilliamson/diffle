// file-content routes: new-side text for previews, raw bytes for media a markdown file
// embeds, and the static client assets. every path is checked against traversal.

import { readFileSync, realpathSync } from "node:fs";
import { join, extname } from "node:path";
import type { ServerContext } from "./handlers";
import type { AssetSource } from "./assetSource";
import type { FileContentResponse } from "../types";
import { runGitBytes } from "../utils/git";
import { apiError, json } from "./respond";
import { containsPath, insideDir, isAbsolutePath } from "../utils/pathWithin";

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm",
};

function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

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

// serve a static client asset through the given source (directory in dev, embedded in the binary).
export function serveStatic(assets: AssetSource, pathname: string): Response {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (rel.includes("..")) return apiError("not found", 404);
  const bytes = assets.read(rel);
  if (!bytes) return apiError("not found", 404);
  return new Response(bytes, { headers: { "Content-Type": contentTypeFor(rel) } });
}

export function notFound(): Response {
  return apiError("not found", 404);
}
