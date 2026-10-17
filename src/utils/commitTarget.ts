// resolves a `<rev>^!` spec (what `nittle show [rev]` sends) into a diff plan pinned to the full commit hash.

import type { CommitInfo } from "../types";
import type { DiffPlan } from "./git";
import { runGit } from "./git";

export const COMMIT_SPEC_SUFFIX = "^!";
const FIELD_SEPARATOR = "\x1f";
const SHORT_HASH_LENGTH = 7;
// git computes the empty tree for the repo's own hash algorithm, so sha1 and sha256 repos both work.
const EMPTY_TREE_ARGS = ["hash-object", "-t", "tree", "/dev/null"];
const COMMIT_FORMAT = ["%H", "%h", "%an", "%aI", "%s", "%P", "%b"].join(FIELD_SEPARATOR);

export function isCommitSpec(spec: string): boolean {
  return spec.length > COMMIT_SPEC_SUFFIX.length && spec.endsWith(COMMIT_SPEC_SUFFIX);
}

function readCommit(rev: string, cwd: string): CommitInfo & { parents: string[] } {
  let raw: string;
  try {
    raw = runGit(["log", "-1", `--format=${COMMIT_FORMAT}`, `${rev}^{commit}`, "--"], cwd);
  } catch {
    throw new Error(`unknown commit: ${rev}`);
  }
  const [hash = "", shortHash = "", author = "", date = "", subject = "", parentList = "", ...bodyParts] = raw.split(FIELD_SEPARATOR);
  const parents = parentList.split(" ").filter(Boolean);
  return { hash, shortHash, author, date, subject, body: bodyParts.join(FIELD_SEPARATOR).trim(), isMerge: parents.length > 1, baseShortHash: null, parents };
}

// root commits diff against the empty tree, merges against their first parent.
export function resolveCommit(spec: string, cwd: string): DiffPlan {
  const rev = spec.slice(0, -COMMIT_SPEC_SUFFIX.length);
  const { parents, ...info } = readCommit(rev, cwd);
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
