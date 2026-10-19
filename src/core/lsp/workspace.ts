// where each side of a review lives on disk for the language servers. working-tree and staged
// reviews (and any ref the checkout is clean at) use the repository root; every other revision
// gets its own detached worktree under a temp dir, so the user's checkout, index and HEAD are
// never touched. a worktree moves to a new commit only while its own status is clean.

import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LspSide } from "../../types";
import { addDetachedWorktree, isCheckoutClean, moveDetachedWorktree, removeWorktree, resolveCommitHash } from "../../utils/gitWorktree";
import { PRODUCT } from "../product";

export const WORKTREE_PREFIX = `${PRODUCT.name}-lsp-wt-`; // <prefix><pid>-<random>/{new,old}
const SHORT_HASH = 8;

export type SideRoot = { root: string } | { unavailable: string };
interface Slot { path: string; commit: string }

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const short = (commit: string): string => commit.slice(0, SHORT_HASH);

export class LspWorkspace {
  private baseDir: string | undefined;
  private readonly slots = new Map<LspSide, Slot>();
  private readonly blockers = new Map<LspSide, string>();
  private readonly decided = new Map<LspSide, { key: string; answer: SideRoot }>();

  constructor(private readonly repoRoot: string) {}

  // why a worktree could not follow the review, when it could not
  get blocker(): string | undefined { return [...this.blockers.values()].join("; ") || undefined; }

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
    try { return { root: this.worktreeAt(side, commit) }; } catch (error) {
      return { unavailable: `cannot open a detached worktree: ${reason(error)}` };
    }
  }

  private worktreeAt(side: LspSide, commit: string): string {
    const slot = this.slots.get(side);
    if (!slot) return this.addWorktree(side, commit);
    if (slot.commit === commit) { this.blockers.delete(side); return slot.path; }
    if (!isCheckoutClean(slot.path)) {
      this.blockers.set(side, `the ${side} worktree has local changes, so it stays at ${short(slot.commit)} instead of ${short(commit)}`);
      return slot.path;
    }
    try {
      moveDetachedWorktree(slot.path, commit);
      slot.commit = commit;
      this.blockers.delete(side);
    } catch (error) {
      this.blockers.set(side, `the ${side} worktree could not move to ${short(commit)}: ${reason(error)}`);
    }
    return slot.path;
  }

  private addWorktree(side: LspSide, commit: string): string {
    this.baseDir ??= realpathSync.native(mkdtempSync(join(tmpdir(), `${WORKTREE_PREFIX}${process.pid}-`)));
    const path = join(this.baseDir, side);
    addDetachedWorktree(this.repoRoot, path, commit);
    this.slots.set(side, { path, commit });
    this.blockers.delete(side);
    return path;
  }

  // removes every worktree this workspace made; safe to call twice.
  dispose(): void {
    for (const slot of this.slots.values()) removeWorktree(this.repoRoot, slot.path);
    this.slots.clear();
    this.decided.clear();
    this.blockers.clear();
    if (this.baseDir) { try { rmSync(this.baseDir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* the os cleans temp */ } }
    this.baseDir = undefined;
  }
}
