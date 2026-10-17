// resolves a `<rev>^!` spec (what `nittle show [rev]` sends) into a diff plan pinned to the full commit hash.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CommitInfo } from "../types";
import type { DiffPlan } from "./git";
import { runGit } from "./git";

export const COMMIT_SPEC_SUFFIX = "^!";
// git never stores NUL in names or messages, so commit metadata can't forge a field boundary
const FIELD_SEPARATOR = "\x00";
const HASH_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const SHORT_HASH_LENGTH = 7;
// git computes the empty tree for the repo's own hash algorithm, so sha1 and sha256 repos both work.
const EMPTY_TREE_ARGS = ["hash-object", "-t", "tree", "/dev/null"];
// structural fields come from their own call, so free text can never shift them into git args
const STRUCTURE_FORMAT = "%H %h %P";
const TEXT_FORMAT = ["%an", "%aI", "%s", "%b"].join("%x00");

export function isCommitSpec(spec: string): boolean {
  return spec.length > COMMIT_SPEC_SUFFIX.length && spec.endsWith(COMMIT_SPEC_SUFFIX);
}

// a single plain rev only: no options, ranges, exclusions or revision sets.
function assertSingleRev(rev: string): void {
  if (rev.startsWith("-")) throw new Error(`invalid commit: ${rev} (a commit can't start with "-")`);
  if (rev.startsWith("^") || rev.includes("..") || /\s/.test(rev)) {
    throw new Error(`show takes one commit, not a range or revision set: ${rev}`);
  }
}

function readCommit(rev: string, cwd: string): CommitInfo & { parents: string[] } {
  assertSingleRev(rev);
  let fullHash: string;
  try {
    fullHash = runGit(["rev-parse", "--verify", "--end-of-options", `${rev}^{commit}`], cwd).trim();
  } catch {
    throw new Error(`unknown commit: ${rev}`);
  }
  const [hash = "", shortHash = "", ...parents] = runGit(["log", "-1", `--format=${STRUCTURE_FORMAT}`, fullHash, "--"], cwd).trim().split(/\s+/);
  if (![hash, ...parents].every((h) => HASH_PATTERN.test(h))) throw new Error(`unexpected commit metadata for ${rev}`);
  const text = runGit(["log", "-1", `--format=${TEXT_FORMAT}`, fullHash, "--"], cwd);
  const [author = "", date = "", subject = "", ...bodyParts] = text.split(FIELD_SEPARATOR);
  return { hash, shortHash, author, date, subject, body: bodyParts.join("").trim(), isMerge: parents.length > 1, baseShortHash: null, parents };
}

// a shallow clone hides the parents of its boundary commits, which would otherwise look like roots.
function isShallowBoundary(hash: string, cwd: string): boolean {
  const shallowFile = resolve(cwd, runGit(["rev-parse", "--git-path", "shallow"], cwd).trim());
  return existsSync(shallowFile) && readFileSync(shallowFile, "utf8").split("\n").some((line) => line.trim() === hash);
}

// root commits diff against the empty tree, merges against their first parent.
export function resolveCommit(spec: string, cwd: string): DiffPlan {
  const rev = spec.slice(0, -COMMIT_SPEC_SUFFIX.length);
  const { parents, ...info } = readCommit(rev, cwd);
  if (parents.length === 0 && isShallowBoundary(info.hash, cwd)) {
    throw new Error(`${info.shortHash} is at the edge of a shallow clone, so its parent isn't here. fetch it with: git fetch --deepen=1`);
  }
  const base = parents[0] ?? runGit(EMPTY_TREE_ARGS, cwd).trim();
  const commit: CommitInfo = { ...info, baseShortHash: parents[0] ? parents[0].slice(0, SHORT_HASH_LENGTH) : null };
  return {
    diffArgs: ["diff", base, info.hash],
    refLabel: `commit ${info.shortHash}`,
    newRef: info.hash,
    mode: "commit",
    source: info.shortHash,
    target: commit.baseShortHash ?? "empty tree",
    includeUntracked: false,
    pinnedSpec: `${info.hash}${COMMIT_SPEC_SUFFIX}`,
    commit,
  };
}
