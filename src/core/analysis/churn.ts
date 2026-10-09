// recent commit count per path, a cheap "this file is hot" signal for review prioritization.

import { runGit } from "../../utils/git";

export const CHURN_WINDOW_DAYS = 90;
// stay well under the windows command-line limit; past it the log is read unfiltered
export const MAX_PATHSPEC_CHARS = 24000;

// counts commits touching each requested path in the window, up to `excludeRef` (default HEAD) so the
// change under review isn't counted against itself. any git failure degrades to zeros.
export function fileChurn(paths: string[], cwd: string, excludeRef?: string | null): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(paths.map((path) => [path, 0]));
  if (!paths.length) return counts;
  try {
    const pathspec = paths.join("").length + paths.length > MAX_PATHSPEC_CHARS ? [] : paths;
    const args = ["-c", "core.quotepath=off", "--literal-pathspecs", "log", `--since=${CHURN_WINDOW_DAYS} days ago`, "--format=", "--name-only", excludeRef || "HEAD", "--", ...pathspec];
    for (const line of runGit(args, cwd).split("\n")) {
      const path = line.trim();
      if (path in counts) counts[path] = (counts[path] ?? 0) + 1;
    }
  } catch {
    // shallow repo, no commits, bad ref
  }
  return counts;
}
