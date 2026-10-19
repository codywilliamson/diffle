// where each side of a review lives on disk for the language servers. working-tree and staged
// reviews (and any ref the checkout is clean at) use the repository root; every other revision
// gets its own detached worktree under a temp dir, so the user's checkout, index and HEAD are
// never touched. a worktree moves to a new commit only while its own status is clean; while it
// cannot, that side answers "blocked" rather than describing the wrong revision.

import { mkdtempSync, realpathSync, rmdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { LspSide } from "../../types";
import { addDetachedWorktree, isCheckoutClean, moveDetachedWorktree, removeWorktree, resolveCommitHash } from "../../utils/gitWorktree";
import { PRODUCT } from "../product";
import { LIMITED_NOTE, linkDependencies, unlinkDependencies } from "./dependencyLinks";
import { OWNER_FILE, writeOwnership } from "./worktreeOwnership";

export const WORKTREE_PREFIX = `${PRODUCT.name}-lsp-wt-`; // <prefix><pid>-<random>/{new,old}
const SHORT_HASH = 8;

export type SideRoot = { root: string } | { unavailable: string; blocked?: boolean };
interface Slot { path: string; commit: string; links: string[] }

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const short = (commit: string): string => commit.slice(0, SHORT_HASH);
const posix = (path: string): string => path.replaceAll("\\", "/");

export class LspWorkspace {
  private baseDir: string | undefined;
  private readonly slots = new Map<LspSide, Slot>();
  private readonly blockers = new Map<LspSide, string>();
  private readonly limits = new Set<LspSide>();
  private readonly decided = new Map<LspSide, { key: string; answer: SideRoot }>();

  constructor(private readonly repoRoot: string) {}

  // why a worktree could not follow the review, when it could not
  get blocker(): string | undefined { return [...this.blockers.values()].join("; ") || undefined; }
  // set when a worktree runs without the checkout's installed dependencies
  get limited(): string | undefined { return this.limits.size > 0 ? LIMITED_NOTE : undefined; }

  // `ref` is the revision holding this side (null: the working tree, or no base commit at all).
  // decisions are remembered per diff generation, so a burst of requests runs git once.
  rootFor(side: LspSide, ref: string | null, generation: number): SideRoot {
    const key = `${generation}\0${ref}`;
    const known = this.decided.get(side);
    if (known?.key === key) return known.answer;
    const answer = this.decide(side, ref);
    this.decided.set(side, { key, answer });
    return answer;
  }

  private decide(side: LspSide, ref: string | null): SideRoot {
    if (side === "new" && (ref === null || ref === "")) return { root: this.repoRoot }; // disk or index is what the reviewer sees
    if (ref === null) return { unavailable: "this review has no base commit to open" };
    const commit = resolveCommitHash(ref, this.repoRoot);
    if (!commit) return { unavailable: `cannot resolve ${ref} to a commit` };
    if (commit === resolveCommitHash("HEAD", this.repoRoot) && isCheckoutClean(this.repoRoot)) return { root: this.repoRoot };
    try { return this.worktreeAt(side, commit); } catch (error) {
      return { unavailable: `cannot open a detached worktree: ${reason(error)}` };
    }
  }

  private worktreeAt(side: LspSide, commit: string): SideRoot {
    const slot = this.slots.get(side);
    if (!slot) return { root: this.addWorktree(side, commit) };
    if (slot.commit === commit) { this.blockers.delete(side); return { root: slot.path }; }
    const ours = slot.links.map((link) => posix(relative(slot.path, link)));
    if (!isCheckoutClean(slot.path, ours)) return this.block(side, `the ${side} worktree has local changes, so it stays at ${short(slot.commit)} instead of ${short(commit)}`);
    try {
      moveDetachedWorktree(slot.path, commit);
    } catch (error) {
      return this.block(side, `the ${side} worktree could not move to ${short(commit)}: ${reason(error)}`);
    }
    slot.commit = commit;
    this.link(side, slot);
    this.blockers.delete(side);
    return { root: slot.path };
  }

  private block(side: LspSide, why: string): SideRoot {
    this.blockers.set(side, why);
    return { unavailable: why, blocked: true };
  }

  private addWorktree(side: LspSide, commit: string): string {
    this.baseDir ??= realpathSync.native(mkdtempSync(join(tmpdir(), `${WORKTREE_PREFIX}${process.pid}-`)));
    const path = join(this.baseDir, side);
    const slot: Slot = { path, commit, links: [] };
    addDetachedWorktree(this.repoRoot, path, commit);
    this.slots.set(side, slot);
    this.link(side, slot);
    this.blockers.delete(side);
    return path;
  }

  private link(side: LspSide, slot: Slot): void {
    const { links, limited } = linkDependencies(this.repoRoot, slot.path, slot.links);
    slot.links = links;
    if (limited) this.limits.add(side); else this.limits.delete(side);
    this.writeOwnership();
  }

  private writeOwnership(): void {
    if (!this.baseDir) return;
    const slots = [...this.slots.values()];
    try { writeOwnership(this.baseDir, { pid: process.pid, repo: this.repoRoot, worktrees: slots.map((slot) => slot.path), links: slots.flatMap((slot) => slot.links) }); } catch { /* cleanup falls back to doing nothing */ }
  }

  // removes every worktree this workspace made; safe to call twice. links go first, as links.
  dispose(): void {
    let removedAll = true;
    for (const slot of this.slots.values()) {
      try {
        if (!unlinkDependencies(slot.links)) throw new Error("a dependency link would not unlink");
        removeWorktree(this.repoRoot, slot.path);
      } catch { removedAll = false; } // the ownership note stays, so `cleanup` can finish the job
    }
    this.slots.clear();
    this.decided.clear();
    this.blockers.clear();
    this.limits.clear();
    if (this.baseDir && removedAll) {
      try { rmSync(join(this.baseDir, OWNER_FILE), { force: true }); rmdirSync(this.baseDir); } catch { /* not empty (left for cleanup) or already gone */ }
    }
    this.baseDir = undefined;
  }
}
