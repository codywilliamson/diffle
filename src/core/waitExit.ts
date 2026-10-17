// `--wait` exit codes, shared by the runner and `--help`.

export const EXIT_RETURNED = 0; // feedback returned (prompt on stdout) or review approved (stdout empty)
export const EXIT_CANCELLED = 2; // reviewer cancelled the review
export const EXIT_TAB_CLOSED = 3; // last tab closed before the reviewer returned anything
export const EXIT_INTERRUPTED = 130; // ctrl+c / kill while waiting
export const EXIT_STOPPED = 4; // session stopped from outside (cleanup, /api/session/stop) while waiting

export const WAIT_EXIT_HELP = [
  "Exit codes with --wait:",
  `  ${EXIT_RETURNED}   feedback returned (prompt on stdout) or review approved (stdout empty without --json)`,
  `  ${EXIT_CANCELLED}   review cancelled (stdout empty without --json)`,
  `  ${EXIT_TAB_CLOSED}   last tab closed without returning feedback (stdout empty, resume hint on stderr)`,
  "  1   error",
  `  ${EXIT_INTERRUPTED}  interrupted (ctrl+c) while waiting; the review stays open`,
  `  ${EXIT_STOPPED}   session stopped from outside (for example by cleanup); the review stays open`,
  "",
  "With --json, stdout is always the get_review JSON for feedback, approved and cancelled.",
  "Without it, only returned feedback prints (the prompt). Tab closed, stopped and errors print nothing.",
];
