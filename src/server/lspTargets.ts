// turns the uris a language server returns into things the client can show: repo-relative paths,
// the text behind them, and ranges in client coordinates. every file:// target handed out is
// remembered per server so GET /api/lsp/file can serve exactly those and nothing else.

import { readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LspLocation, LspRange } from "../types";
import type { WireRange } from "../core/lsp/protocol";
import { fromLspCharacter, type PositionEncoding } from "../core/lsp/positions";
import { containsPath } from "../utils/pathWithin";
import { runGitBytes } from "../utils/git";
import { readWorkingTree } from "./fileHandlers";
import type { ServerContext } from "./handlers";

export const MAX_TARGET_FILE_BYTES = 2 * 1024 * 1024;
const DEPENDENCY_DIR = "node_modules";
const CASE_INSENSITIVE = process.platform === "win32" || process.platform === "darwin";
const fold = (path: string): string => (CASE_INSENSITIVE ? path.toLowerCase() : path);
export const splitLines = (text: string): string[] => text.split(/\r\n|\r|\n/);

const allowlists = new WeakMap<ServerContext, Set<string>>();
export const pathKey = (path: string): string => fold(resolve(path));
export function isAllowedTarget(ctx: ServerContext, absolutePath: string): boolean { return allowlists.get(ctx)?.has(pathKey(absolutePath)) ?? false; }

export const repoRootOf = (ctx: ServerContext): string => resolve(ctx.lsp?.root ?? ctx.cwd);
export const fileUriOf = (ctx: ServerContext, path: string): string => pathToFileURL(resolve(repoRootOf(ctx), path)).href;
export const sameFile = (a: string, b: string): boolean => {
  try { return pathKey(fileURLToPath(a)) === pathKey(fileURLToPath(b)); } catch { return a === b; }
};

// the reviewed (new) side of a repo file: disk, the index or a ref blob, matching the diff. throws when absent.
export function readRepoText(ctx: ServerContext, path: string): string {
  const root = repoRootOf(ctx);
  return (ctx.newRef === null ? readWorkingTree(root, path) : runGitBytes(["show", `${ctx.newRef}:${path}`], root)).toString("utf8");
}

function readOutsideRepo(absolutePath: string): string | undefined {
  try {
    if (statSync(absolutePath).size > MAX_TARGET_FILE_BYTES) return undefined;
    return readFileSync(absolutePath, "utf8");
  } catch { return undefined; }
}

export class TargetResolver {
  private readonly texts = new Map<string, string | undefined>();
  private readonly inDiffPaths: Set<string>;

  constructor(private readonly ctx: ServerContext, private readonly encoding: PositionEncoding) {
    this.inDiffPaths = new Set(ctx.diff.files.map((file) => file.path));
  }

  // seeds the text the server was told about, so results convert against exactly that.
  seed(absolutePath: string, text: string): void { this.texts.set(pathKey(absolutePath), text); }

  // undefined for non-file uris (jar:, csharp:, ^/memfs); those cannot be shown.
  locate(uri: string): LspLocation | undefined {
    if (!uri.startsWith("file:")) return undefined;
    let absolutePath: string;
    try { absolutePath = fileURLToPath(uri); } catch { return undefined; }
    const root = repoRootOf(this.ctx);
    const rel = containsPath(fold(root), fold(absolutePath)) ? relative(root, absolutePath).split(sep).join("/") : null;
    const inRepo = rel !== null && rel !== "" && !rel.split("/").includes(DEPENDENCY_DIR);
    let allowed = allowlists.get(this.ctx);
    if (!allowed) allowlists.set(this.ctx, (allowed = new Set()));
    allowed.add(pathKey(absolutePath));
    return { uri, path: inRepo ? rel : null, absolutePath, inRepo, inDiff: inRepo && this.inDiffPaths.has(rel) };
  }

  text(location: LspLocation): string | undefined {
    const key = pathKey(location.absolutePath);
    if (!this.texts.has(key)) {
      let text: string | undefined;
      if (location.path) { try { text = readRepoText(this.ctx, location.path); } catch { text = undefined; } }
      this.texts.set(key, text ?? (location.inRepo ? undefined : readOutsideRepo(location.absolutePath)));
    }
    return this.texts.get(key);
  }

  lines(location: LspLocation): string[] | undefined {
    const text = this.text(location);
    return text === undefined ? undefined : splitLines(text);
  }

  // wire range -> client range (1-based lines, utf-16 characters). without the file's text the
  // characters pass through, which is exact for the default utf-16 encoding.
  range(location: LspLocation, range: WireRange): LspRange {
    const lines = this.lines(location);
    const convert = (p: WireRange["start"]) => ({
      line: p.line + 1,
      character: lines ? fromLspCharacter(lines[p.line] ?? "", p.character, this.encoding) : p.character,
    });
    return { start: convert(range.start), end: convert(range.end) };
  }
}
