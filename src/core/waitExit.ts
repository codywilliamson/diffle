// `--wait` exit codes, shared by the runner and `--help`.

export const EXIT_RETURNED = 0; // feedback returned (prompt on stdout) or review approved (stdout empty)
export const EXIT_CANCELLED = 2; // reviewer cancelled the review
export const EXIT_TAB_CLOSED = 3; // last tab closed before the reviewer returned anything
export const EXIT_INTERRUPTED = 130; // ctrl+c / kill while waiting

export const WAIT_EXIT_HELP = [
  "Exit codes with --wait:",
  `  ${EXIT_RETURNED}   feedback returned (prompt on stdout) or review approved (stdout empty)`,
  `  ${EXIT_CANCELLED}   review cancelled (stdout empty)`,
  `  ${EXIT_TAB_CLOSED}   last tab closed without returning feedback (stdout empty, resume hint on stderr)`,
  "  1   error",
  `  ${EXIT_INTERRUPTED}  interrupted (ctrl+c) while waiting; the review stays open`,
];
