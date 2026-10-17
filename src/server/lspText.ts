// reads the text language servers and the client work from. every file read opens the file once,
// insists on a regular file (a fifo or device would hang or stream forever) and reads a bounded
// amount from that same descriptor. the reviewed side of a repo file is cached: ref and index
// blobs for as long as the diff object they were read under, working-tree files by mtime + size.

import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { containsPath } from "../utils/pathWithin";
import { runGitBytes } from "../utils/git";
import type { ServerContext } from "./handlers";

export const MAX_TARGET_FILE_BYTES = 2 * 1024 * 1024;
const NONBLOCK = constants.O_NONBLOCK ?? 0; // posix only; opening a fifo must not wait for a writer

interface Stamp { mtimeMs: number; size: number; text: string }

// one open, one fstat, one bounded read. undefined: not a regular file, too big, or unreadable.
export function readRegularFile(path: string, known?: Stamp): Stamp | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_TARGET_FILE_BYTES) return undefined;
    if (known && known.mtimeMs === stat.mtimeMs && known.size === stat.size) return known;
    const buffer = Buffer.alloc(stat.size);
    let filled = 0;
    while (filled < buffer.length) {
      const n = readSync(fd, buffer, filled, buffer.length - filled, filled);
      if (n === 0) break;
      filled += n;
    }
    return { mtimeMs: stat.mtimeMs, size: stat.size, text: buffer.subarray(0, filled).toString("utf8") };
  } catch { return undefined; } finally { if (fd !== undefined) closeSync(fd); }
}

export const readOutsideRepo = (absolutePath: string): string | undefined => readRegularFile(absolutePath)?.text;

const stamps = new WeakMap<ServerContext, Map<string, Stamp>>();
const blobs = new WeakMap<object, Map<string, string>>(); // keyed by the diff object: a refresh starts over

export const repoRootOf = (ctx: ServerContext): string => resolve(ctx.lsp?.root ?? ctx.cwd);

// the reviewed (new) side of a repo file: disk, the index or a ref blob, matching the diff. throws when absent.
export function readRepoText(ctx: ServerContext, path: string): string {
  const root = repoRootOf(ctx);
  if (ctx.newRef !== null) {
    const cache = blobs.get(ctx.diff) ?? new Map<string, string>();
    blobs.set(ctx.diff, cache);
    const key = `${ctx.newRef}\0${path}`;
    let text = cache.get(key);
    if (text === undefined) {
      const bytes = runGitBytes(["show", `${ctx.newRef}:${path}`], root);
      if (bytes.length > MAX_TARGET_FILE_BYTES) throw new Error("file too large");
      text = bytes.toString("utf8");
      cache.set(key, text);
    }
    return text;
  }
  const real = realpathSync(join(root, path));
  if (!containsPath(realpathSync(root), real)) throw new Error("outside repo");
  const known = stamps.get(ctx)?.get(real);
  const read = readRegularFile(real, known);
  if (!read) throw new Error("not a readable regular file");
  const table = stamps.get(ctx) ?? new Map<string, Stamp>();
  stamps.set(ctx, table);
  table.set(real, read);
  return read.text;
}
