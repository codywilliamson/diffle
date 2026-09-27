// what's-new highlights for the current release. auto-shown once per version the reviewer
// hasn't seen; the seen version persists server-side (state.json) via /api/state.
export const WHATS_NEW = {
  version: "0.22.3",
  highlights: [
    "All-files view now lists diffs in the same order as the sidebar tree, and j/k step through files in that order too, so reviewing top to bottom no longer jumps around.",
    "Changed-word highlights in dark mode are readable again: they keep the line's text color instead of turning black on dark red and green.",
    "Thanks to @jmpompeo for reporting both of these.",
  ],
};
