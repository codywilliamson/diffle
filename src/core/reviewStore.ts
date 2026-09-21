// read/write the .review json file and keep it out of git via .git/info/exclude.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { REVIEW_FILE, type ReviewFile } from "../types";
import { PRODUCT } from "./product";
import { gitExcludePath, isIgnored } from "../utils/git";

// reads <dir>/.review; null if absent or unparseable.
export function readReview(dir: string): ReviewFile | null {
  const path = join(dir, REVIEW_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ReviewFile;
  } catch {
    return null;
  }
}

// writes <dir>/.review (pretty json, 2-space + trailing newline) then, unless the user opted
// into reviewing it, tells git to ignore it locally. won't create the file just from browsing or
// marking viewed — only once there's a comment worth saving. an existing .review keeps updating
// (even to empty) so edits never get lost.
export function writeReview(dir: string, review: ReviewFile, excludeFromGit = true): void {
  const path = join(dir, REVIEW_FILE);
  if (!existsSync(path) && review.comments.length === 0) return;
  writeFileSync(path, `${JSON.stringify(review, null, 2)}\n`);
  if (excludeFromGit) appendToGitExclude(dir);
}

// .git/info/exclude, not .gitignore: .gitignore is tracked, so editing it would show up as a
// repo change in the very review loupe is running. the exclude file is per-clone and private.
function appendToGitExclude(dir: string): void {
  const relative = gitExcludePath(dir);
  if (!relative || isIgnored(REVIEW_FILE, dir)) return;

  const path = resolve(dir, relative);
  const content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}${separator}${REVIEW_FILE}\n`);
  console.log(`[${PRODUCT.name}] Added ${REVIEW_FILE} to .git/info/exclude`);
}
