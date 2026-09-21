# diffle client parity contract

The Svelte client may change the presentation, but it does not ship until these loupe behaviors still work. This is an acceptance reference, not a component map: Svelte modules may be shaped differently from the current Preact files.

## Review targets and navigation

- Working-tree, staged, branch, range, and codebase-browse reviews render the server-provided `DiffResult` without redefining its types.
- All-files and single-file modes work. Selecting a file scrolls or switches predictably, and refresh preserves the reviewer's comments and useful navigation state.
- The file index groups paths, filters by path, shows change kind/deltas and unresolved-comment counts, tracks viewed files, resizes on desktop, and becomes an accessible drawer on narrow screens.
- Added, modified, deleted, renamed, untracked, empty, binary, and very large files have deliberate states. Browse mode suppresses diff-only controls and hunk decoration.
- The file index shows viewed progress: a fill bar and a "viewed N of total" count derived from the viewed set, updating live as files are marked viewed.
- Directory groups in the index are individually collapsible (default expanded), expose `aria-expanded`, indent by depth, and keep collapsed children rendered-but-inert so the accordion animates without leaking them into the tab order.
- When the path filter matches no files, the index shows an explicit "No files match" empty state instead of an empty tree.
- Single-file mode falls back to the first file when nothing is selected (or the selected path is no longer in the diff), so the pane is never blank.
- Selecting a file from the drawer on narrow screens closes the drawer as part of navigating to that file.

## Reading the change

- Unified and side-by-side views preserve old/new line coordinates, word-level marks, syntax highlighting, wrapping, independent split-pane horizontal movement, split resizing, sticky file headers, file collapse, and large-diff lazy mounting.
- Markdown files can switch between diff and sanitized rendered preview. Relative images resolve through `/api/raw`; repository reads stay contained to the real review root.
- Stale comments whose anchors no longer exist remain visible and editable instead of disappearing.
- Each file has its own Side-by-side/Unified toggle that overrides the global split choice for that file; a global split flip resets every per-file override.
- Added and deleted files (content on only one side) are forced to the unified view and hide the side-by-side toggle.
- In side-by-side view, shift+wheel or a horizontal trackpad swipe scrolls the hovered pane horizontally, deferring to vertical scroll at the pane edge.
- External links in the rendered markdown preview open in a new tab (`rel=noopener`) so the review stays put.
- Files over ~2000 lines render a "large diff hidden" notice with a Load-diff button — a manual gate distinct from the near-viewport lazy mount.

## Writing feedback

- A reviewer can add file-, line-, and inclusive range-level comments on the old or new side; tag, edit, and delete them; and use the existing keyboard save/cancel behavior.
- Open, addressed, and resolved comments remain distinct. The agent may mark addressed; only the reviewer may resolve or reopen. Replies preserve author and order.
- Reviewer mutations use the server response as the next authoritative record. Polling and local writes cannot let an older response overwrite a newer `updatedAt`, and changing `reviewId` invalidates in-flight work for the previous review.
- Viewed files and comments still support legacy `.review` mode. A discovered legacy file can be imported, ignored, or explicitly removed; it is never silently changed.
- A reviewer's full-replace comments save merges per-field on the server: agent-owned fields (replies, status, resolved) are preserved from the stored record, so a stale reviewer save cannot clobber an agent reply or addressed mark.
- Each line or range comment captures the raw targeted diff line (leading +/-/space marker plus content); file-level comments store `null` line content.
- Range comments are created by drag-selecting lines (live range highlight, editor opens on release) and extended by shift-click on the same side; anchors are (side, line) pairs so old- and new-side lines never collide.
- Empty comments and replies cannot be submitted: Save/Send stay disabled on blank text, and Ctrl/Cmd+Enter on empty text shakes the editor instead of saving.
- Reviewer replies are available only for durable Review Records; legacy `.review` mode exposes no reply thread or reply control.

## Review outcomes and live agent activity

- A Review Session shows its status and unresolved count. Feedback may be returned with unresolved comments, a non-empty Review Summary, or both.
- Approval warns when unresolved comments remain. Cancellation confirms when it would discard meaningful in-progress feedback. Terminal states disable invalid actions.
- JSON and Markdown feedback copy remain available. The rendered feedback preview, raw fallback, and clipboard failure state remain usable.
- The client notices agent replies, addressed marks, and rereview requests without reloading. A rereview after approval reopens the same Review Record, and the diff refresh remains an explicit reviewer action.
- Agent activity is polled every 3s only while the tab is visible (with an immediate poll on refocus), and the server keeps each record's `updatedAt` strictly monotonic (bumped +1ms when two writes share a millisecond) so the client's skip guard never drops or reorders an update.
- The review popover shows a contextual guidance line that adapts to status and to whether an agent is connected: manual reviews are told to paste the copied feedback into the conversation; agent-connected reviews are told to return to the agent and say "continue".
- The review popover surfaces the latest agent rereview-request summary as a persistent "Agent update" block, distinct from and outliving the dismissible sync notice.
- Unread agent-activity notices accumulate across polls until dismissed: reply and addressed counts add up, rereview/reopened flags OR together, and the newest rereview summary wins.

## Preferences, accessibility, and responsive behavior

- Light/dark theme, sidebar width, split/unified choice, wrapping, and file-view mode survive reloads. Phase 5 migrates legacy `loupe-*` keys when the brand changes.
- Current shortcuts remain discoverable and ignore editable controls. Escape closes only the active overlay, focus returns to the trigger, dialogs trap focus, and popovers dismiss on outside interaction.
- Keyboard focus, screen-reader names, contrast, touch targets, loading/error/empty states, clipboard fallbacks, and reduced motion are verified in both themes and at desktop and phone widths.
- What's New and update status remain available, but Phase 6 replaces clone-oriented update text with release-channel behavior.
- With no saved theme, the initial theme follows the OS `prefers-color-scheme` setting.
- Legacy `claude` / `claude-dark` theme values are migrated to `light` / `dark` at read time and rewritten to storage, so old saved preferences survive. This is distinct from the Phase 5 `loupe-*` key rename, which has not happened yet.
- What's New auto-opens once per version the reviewer hasn't seen; the seen version persists server-side in the user's data directory (`state.json`), not per-origin storage, so it stays dismissed across launches on different ports.
- The update badge polls `/api/update` every 10 minutes and only appears while the install is behind, hiding (and dismissing its popover) when current.
- On narrow screens the header tools collapse into one overflow menu (`role=menu`) with roving Arrow/Home/End navigation, per-item shortcut-key hints, focus opening on the first item, and focus returning to the trigger on close.

## Required evidence

- Every behavior is implemented through a red → green vertical slice at an agreed public seam. Playwright provides the browser tracer; Vitest and Testing Library cover narrower behavior without testing private implementation details.
- Pure state and formatting behavior has Vitest coverage; Svelte interactions use Testing Library.
- Playwright covers launch, initial diff, add/edit/resolve feedback, Return Feedback, agent update/rereview simulation, refresh, and approval against a temporary Git fixture.
- Before deleting the old source, compare the captured Preact baseline and the Svelte client against this checklist at desktop and phone widths. Record any intentional difference in the changelog or an ADR when it changes a durable contract.

## Reconciliation notes (2026-09-20)

A Phase 0 audit of the live Preact client folded the behaviors above into this checklist. It also surfaced three claims where the current client does **not** match the contract. These are human decisions for the rewrite, not Phase 0 work — each is "implement in diffle to honor the contract" **or** "amend the contract to match reality":

- **Markdown preview is not sanitized.** The diff/preview switch works, but `markdownView` renders `marked@12` output with no sanitizer (no DOMPurify); `marked` dropped its built-in sanitizer, so raw HTML in a `.md` renders unescaped. Exposure is limited to repository content (reads stay scoped to the review root), but the "sanitized rendered preview" claim above is currently false. Decision: add sanitization in diffle, or drop "sanitized".
- **Dialogs do not trap focus or restore trigger focus.** Modal-based dialogs (help, What's New, compile) set `role=dialog`/`aria-modal` but never cycle Tab, set no initial focus, and don't mark the background inert; trigger-focus restore exists only for anchored popovers. The "dialogs trap focus, and focus returns to the trigger" claim above is an accessibility gap the contract already promises. Decision: implement a focus trap + trigger restore in diffle (recommended), or downgrade the claim.
- **No empty-file state exists.** "empty … files have deliberate states" is unbacked — an empty added file renders an empty table with no rows, and a wholly empty diff renders nothing (no "no changes" message). Every other listed file kind is implemented. Decision: build a real empty-file / empty-diff state in diffle, or drop "empty" from the bullet.
