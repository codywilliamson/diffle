# diffle client parity contract

The Svelte client may change the presentation, but it does not ship until these loupe behaviors still work. This is an acceptance reference, not a component map: Svelte modules may be shaped differently from the current Preact files.

## Review targets and navigation

- Working-tree, staged, branch, range, and codebase-browse reviews render the server-provided `DiffResult` without redefining its types.
- All-files and single-file modes work. Selecting a file scrolls or switches predictably, and refresh preserves the reviewer's comments and useful navigation state.
- The file index groups paths, filters by path, shows change kind/deltas and unresolved-comment counts, tracks viewed files, resizes on desktop, and becomes an accessible drawer on narrow screens.
- Added, modified, deleted, renamed, untracked, empty, binary, and very large files have deliberate states. Browse mode suppresses diff-only controls and hunk decoration.

## Reading the change

- Unified and side-by-side views preserve old/new line coordinates, word-level marks, syntax highlighting, wrapping, independent split-pane horizontal movement, split resizing, sticky file headers, file collapse, and large-diff lazy mounting.
- Markdown files can switch between diff and sanitized rendered preview. Relative images resolve through `/api/raw`; repository reads stay contained to the real review root.
- Stale comments whose anchors no longer exist remain visible and editable instead of disappearing.

## Writing feedback

- A reviewer can add file-, line-, and inclusive range-level comments on the old or new side; tag, edit, and delete them; and use the existing keyboard save/cancel behavior.
- Open, addressed, and resolved comments remain distinct. The agent may mark addressed; only the reviewer may resolve or reopen. Replies preserve author and order.
- Reviewer mutations use the server response as the next authoritative record. Polling and local writes cannot let an older response overwrite a newer `updatedAt`, and changing `reviewId` invalidates in-flight work for the previous review.
- Viewed files and comments still support legacy `.review` mode. A discovered legacy file can be imported, ignored, or explicitly removed; it is never silently changed.

## Review outcomes and live agent activity

- A Review Session shows its status and unresolved count. Feedback may be returned with unresolved comments, a non-empty Review Summary, or both.
- Approval warns when unresolved comments remain. Cancellation confirms when it would discard meaningful in-progress feedback. Terminal states disable invalid actions.
- JSON and Markdown feedback copy remain available. The rendered feedback preview, raw fallback, and clipboard failure state remain usable.
- The client notices agent replies, addressed marks, and rereview requests without reloading. A rereview after approval reopens the same Review Record, and the diff refresh remains an explicit reviewer action.

## Preferences, accessibility, and responsive behavior

- Light/dark theme, sidebar width, split/unified choice, wrapping, and file-view mode survive reloads. Phase 5 migrates legacy `loupe-*` keys when the brand changes.
- Current shortcuts remain discoverable and ignore editable controls. Escape closes only the active overlay, focus returns to the trigger, dialogs trap focus, and popovers dismiss on outside interaction.
- Keyboard focus, screen-reader names, contrast, touch targets, loading/error/empty states, clipboard fallbacks, and reduced motion are verified in both themes and at desktop and phone widths.
- What's New and update status remain available, but Phase 6 replaces clone-oriented update text with release-channel behavior.

## Required evidence

- Pure state and formatting behavior has Vitest coverage; Svelte interactions use Testing Library.
- Playwright covers launch, initial diff, add/edit/resolve feedback, Return Feedback, agent update/rereview simulation, refresh, and approval against a temporary Git fixture.
- Before the default client switches, compare the old and new clients against this checklist in a real browser at desktop and phone widths. Record any intentional difference in the changelog or an ADR when it changes a durable contract.
