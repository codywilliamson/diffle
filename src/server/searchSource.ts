// where a search gets bytes from: old side = base blob, new side = working tree or the new ref.
// git-backed sides are sized and read through one cat-file call each, since a process spawn per file
// would eat the search budget on Windows.

import { statSync } from "node:fs";
import { join } from "node:path";
import type { SearchSide } from "../types";
import { MAX_SEARCH_FILE_BYTES } from "../core/search";
import { MAX_SEARCH_TOTAL_BYTES, type SideSource } from "../core/searchCollect";
import { oldSideRef } from "../core/searchBase";
import { targetsFor } from "../core/searchDiff";
import { insideDir, isAbsolutePath } from "../utils/pathWithin";
import type { ServerContext } from "./handlers";
import { readNewSide } from "./fileHandlers";

const isSafePath = (ctx: ServerContext, path: string) =>
  !path.includes("..") && !path.includes("\n") && !isAbsolutePath(path) && insideDir(ctx.cwd, path);

function catFile(cwd: string, flag: string, specs: string[]): Buffer {
  if (!specs.length) return Buffer.alloc(0);
  const proc = Bun.spawnSync(["git", "cat-file", flag], { cwd, stdin: Buffer.from(`${specs.join("\n")}\n`) });
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString().trim() || "git cat-file failed");
  return proc.stdout;
}

// `blob <size>` or `<spec> missing`, one line per spec
function batchSizes(cwd: string, specs: string[]): Map<string, number> {
  const sizes = new Map<string, number>();
  const lines = catFile(cwd, "--batch-check=%(objecttype) %(objectsize)", specs).toString().split("\n");
  specs.forEach((spec, i) => {
    const [type, size] = (lines[i] ?? "").split(" ");
    if (type === "blob" && size) sizes.set(spec, Number(size));
  });
  return sizes;
}

// `<sha> blob <size>\n<bytes>\n`, in request order
function batchContents(cwd: string, specs: string[]): Map<string, Uint8Array> {
  const out = catFile(cwd, "--batch", specs);
  const contents = new Map<string, Uint8Array>();
  let offset = 0;
  for (const spec of specs) {
    const newline = out.indexOf("\n", offset);
    if (newline < 0) break;
    const [, type, size] = out.toString("utf8", offset, newline).split(" ");
    offset = newline + 1;
    if (type !== "blob" || size === undefined) continue;
    contents.set(spec, out.subarray(offset, offset + Number(size)));
    offset += Number(size) + 1;
  }
  return contents;
}

export function searchSource(ctx: ServerContext): SideSource {
  const base = oldSideRef(ctx.diffArgs, ctx.cwd);
  const gitSpec = (path: string, side: SearchSide): string | null => {
    const revision = side === "old" ? base : ctx.newRef;
    return revision === null || !isSafePath(ctx, path) ? null : `${revision}:${path}`;
  };
  const specs = ctx.diff.files.flatMap(targetsFor).flatMap(({ path, side }) => gitSpec(path, side) ?? []);
  let sizes: Map<string, number>;
  try {
    sizes = batchSizes(ctx.cwd, specs);
  } catch {
    sizes = new Map();
  }
  // read only what collectSides can accept: under the per-file cap, within the aggregate cap
  let budget = MAX_SEARCH_TOTAL_BYTES;
  const readable = specs.filter((spec) => {
    const size = sizes.get(spec);
    if (size === undefined || size > MAX_SEARCH_FILE_BYTES || size > budget) return false;
    budget -= size;
    return true;
  });
  let contents: Map<string, Uint8Array>;
  try {
    contents = batchContents(ctx.cwd, readable);
  } catch {
    contents = new Map();
  }
  const attempt = <T>(run: () => T): T | null => {
    try {
      return run();
    } catch {
      return null;
    }
  };
  return {
    size: (path, side) => {
      const spec = gitSpec(path, side);
      if (spec !== null) return sizes.get(spec) ?? null;
      if (side === "old" || !isSafePath(ctx, path)) return null;
      return attempt(() => statSync(join(ctx.cwd, path)).size);
    },
    read: (path, side) => {
      const spec = gitSpec(path, side);
      if (spec !== null) return contents.get(spec) ?? null;
      return side === "old" || !isSafePath(ctx, path) ? null : attempt(() => readNewSide(ctx, path));
    },
  };
}

