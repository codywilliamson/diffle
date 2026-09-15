// curated "what's new" highlights, newest first. edit this each release to spotlight features.
// dependency-free (no /preact.js import) so the selectors are unit-testable under bun test.

export const WHATS_NEW = [
  {
    version: "0.15.0",
    date: "2026-09-15",
    items: [
      {
        title: "Motion with intent",
        body: "Modals and menus scale in from their trigger and get out of the way faster than they arrive, tooltips wait a beat, the open-comment count pops, folders unfold, the viewed box draws its check, and the phone drawer slides in. Every timing comes from one motion scale and steps aside under reduced motion.",
      },
      {
        title: "Feedback that lands",
        body: "Comment editors, saved cards, and reply threads reveal in place, agent replies stagger in as they arrive, a failed send shakes the composer instead of failing silently, and the sync notice grows in like a toast.",
      },
      {
        title: "A readable markdown preview",
        body: "Rendered .md files get breathing room, a real heading scale, bordered code and tables, and their screenshots now load, resolved against the file's folder. A skeleton holds the slot while the file arrives.",
      },
    ],
  },
  {
    version: "0.14.0",
    date: "2026-09-04",
    items: [
      {
        title: "A calmer review header",
        body: "File counts now sit with the repo and ref on the left. Review and Preview share one control, and the view tools and utilities sit in quiet groups, so the next action reads at a glance instead of competing with six icons.",
      },
      {
        title: "Phones get one overflow menu",
        body: "Below 700px the tools collapse into a single menu with arrow-key navigation and shortcut hints, and nothing scrolls off the edge. Desktop tooltips now show each tool's key too.",
      },
      {
        title: "Return a summary on its own",
        body: "Overall feedback with no line comments now reaches the agent: Return Feedback enables with a summary alone, the record stores it, and the compiled Markdown carries it under a Reviewer summary heading.",
      },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-09-01",
    items: [
      {
        title: "Agent activity shows up live",
        body: "Loupe now watches the Review Record while the tab is open. Replies, addressed marks, and rereview requests appear without a reload, with a quiet notice and a one-click diff refresh when the agent has new changes.",
      },
      {
        title: "Reply in the thread, reopen after approval",
        body: "Answer the agent directly under a comment. Both sides render as one thread and flow into the compiled feedback. If you approve and then ask for one more change, the agent's rereview reopens the same review instead of failing.",
      },
      {
        title: "A clearer review menu",
        body: "The outcome menu is a real popover that closes on Escape, on click-outside, and after an action. The review state and open-comment count now read at a glance from the top bar, and single-sided files always stay unified.",
      },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-08-29",
    items: [
      {
        title: "Review directly with Codex or Claude Code",
        body: "Launch Loupe from your agent, leave line- and file-level feedback in the browser, then return structured comments for the next change. Manual Markdown and JSON copy remain available.",
      },
      {
        title: "Review history stays with Loupe",
        body: "Comments, replies, addressed and resolved threads, summaries, and outcomes now live in durable local Review Records. Existing .review files stay untouched until you choose to import or remove them.",
      },
      {
        title: "Explicit by default, automatic when you want it",
        body: "Codex and Claude Code integrations start reviews only when asked. Install the optional completion-hook companion to open Loupe automatically when an agent finishes.",
      },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-08-17",
    items: [
      {
        title: "Your .review file stays out of the review",
        body: "A .review committed before you ever ran loupe used to show up as a reviewable file in branch, range, staged and browse mode — it's hidden in every mode now. loupe also keeps it out of git via .git/info/exclude instead of .gitignore, so hiding it no longer edits a tracked file mid-review.",
      },
      {
        title: "What's New stays dismissed",
        body: "The version you've seen lives in ~/.loupe/state.json, so this modal stays dismissed even though each launch uses a fresh local port.",
      },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-07-05",
    items: [
      {
        title: "Large diffs are fast now",
        body: "File bodies render lazily as you scroll and interactions only re-render the file you're touching — a 150-file, 40k-line diff paints in seconds instead of freezing the tab.",
      },
      {
        title: "Giant files load on demand",
        body: "Files over 2,000 diff lines start collapsed behind a Load diff button, so one huge lockfile can't slow the rest of the review.",
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-23",
    items: [
      {
        title: "Codebase browse mode",
        body: "Run loupe browse to review the whole codebase — not just a diff. Read any file, leave inline questions, and compile them into a prompt to onboard an LLM (or yourself).",
      },
      {
        title: "What's new, in-app",
        body: "This modal — loupe now greets you with the highlights after each update.",
      },
    ],
  },
];

// the curated entry for an exact version, or null.
export function whatsNewFor(version) {
  return WHATS_NEW.find((entry) => entry.version === version) ?? null;
}

// auto-show only when running a version that has highlights you haven't seen yet.
export function shouldAutoShow(current, seen) {
  return Boolean(current) && current !== seen && whatsNewFor(current) !== null;
}
