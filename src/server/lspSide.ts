// picks the filesystem root a request runs against and gives it a context of its own: the new
// side at the repository root is the context itself; any other root (a detached worktree at the
// new commit, or at the old side's base commit) is a view of it that reads files from that root
// and talks to the servers started there. views are cached, so identity (and every cache keyed
// by context) is stable between requests.

import { resolve } from "node:path";
import type { LspSide } from "../types";
import { oldSideRef } from "../core/searchBase";
import type { ServerContext } from "./handlers";

interface ViewMarks { lspBase?: ServerContext; lspSide?: LspSide }
const views = new WeakMap<ServerContext, Map<string, ServerContext>>();
const oldRefs = new WeakMap<ServerContext, { generation: number; ref: string | null }>();

export const baseContextOf = (ctx: ServerContext): ServerContext => (ctx as ViewMarks).lspBase ?? ctx;
export const sideOfContext = (ctx: ServerContext): LspSide => (ctx as ViewMarks).lspSide ?? "new";

function baseRef(ctx: ServerContext): string | null {
  const generation = ctx.diffGeneration ?? 0;
  const known = oldRefs.get(ctx);
  if (known?.generation === generation) return known.ref;
  const ref = oldSideRef(ctx.diffArgs, ctx.cwd);
  oldRefs.set(ctx, { generation, ref });
  return ref;
}

// the context to serve `side` from, or why it cannot be served.
export function sideContext(ctx: ServerContext, side: LspSide): ServerContext | { unavailable: string } {
  const pool = ctx.lsp;
  if (!pool?.workspace || !pool.view) return side === "new" ? ctx : { unavailable: "this server cannot open the base commit" };
  const answer = pool.workspace.rootFor(side, side === "new" ? ctx.newRef : baseRef(ctx), ctx.diffGeneration ?? 0);
  if ("unavailable" in answer) return answer;
  const root = resolve(answer.root);
  if (side === "new" && root === resolve(pool.root)) return ctx;
  const cache = views.get(ctx) ?? new Map<string, ServerContext>();
  views.set(ctx, cache);
  const key = `${side}\0${root}`;
  let view = cache.get(key);
  if (!view) {
    view = Object.create(ctx, {
      lsp: { value: pool.view(root) }, newRef: { value: null }, lspBase: { value: ctx }, lspSide: { value: side },
    }) as ServerContext;
    cache.set(key, view);
  }
  return view;
}
