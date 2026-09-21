// what's-new highlights for the current release. auto-shown once per version the reviewer
// hasn't seen; the seen version persists server-side (state.json) via /api/state.
export const WHATS_NEW = {
  version: "0.16.0",
  highlights: [
    "loupe is now diffle — same review workflow, a dark-first indigo look (the new D5 design system). Your old command, records, and settings keep working.",
    "A faster Svelte client with a cleaner side-by-side diff: one scrollbar per diff, locked 50/50 panes, line wrapping, and a sanitized Markdown preview.",
    "Ships as a single self-contained binary that runs anywhere — no checkout or Node install needed.",
  ],
};
