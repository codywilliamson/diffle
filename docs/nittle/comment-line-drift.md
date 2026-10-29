# Comment line drift

Found during the launch docs audit. Investigation only, nothing changed yet.

## What happens today

A line comment is anchored by `file`, `side`, `line` and optional `endLine`. `isAnchored` in `src/core/anchor.ts` only asks whether some diff line on that side still carries a number inside `[line, endLine]`. The comment also stores `lineContent` (the raw diff line with its marker, captured in `UnifiedDiff.svelte` and `SplitPane.svelte`), but nothing in `src/` reads it back.

So when the agent edits code above a comment, say adding three lines at the top of the file, the comment keeps `line: 40` while the code it was about moves to line 43. Line 40 still exists in the diff, so the comment counts as anchored. The UI draws it on the wrong line, and `compileReviewPrompt` quotes the context around the new line 40 with the `>` marker (`src/core/promptCompiler.ts:41`). The agent gets feedback pinned to code the reviewer never commented on, and nothing marks it stale.

This mostly bites in the second and later rounds, after the agent has made changes and the reviewer re-opens the same record. It also hits live refresh, since `GET /api/diff` re-runs git on every poll.

## Options

1. Mark stale on content mismatch. In `isAnchored`, when `lineContent` is set, compare it (marker stripped, trailing whitespace ignored) with the current line at `line` on that side. A mismatch counts as unanchored, so `partitionComments` moves the comment to the stale list, and it's left out of the prompt and offered for cleanup. Small change, pure function, easy to test. The cost: a comment whose own line the agent edited (the normal "fix this line" case) also goes stale, which is arguably right, since the code it talks about changed.
2. Re-anchor by content. On mismatch, look for the stored text within a window (say +/-50 lines on the same side). With exactly one match, move the comment there. With none or several, mark it stale. This keeps comments attached across pure shifts. It needs a persistent write: the new `line`/`endLine` has to be saved to the Review Record on the server, or the client, prompt and MCP `get_review` will disagree. Ranges are harder, because only the first line's text is stored, and suggestions carry `original` lines that would need the same move.
3. Both, in that order. Ship 1 first, then 2 as an improvement on top of the same comparison.

## Recommendation

Done: option 1 shipped in `fix(store): mark comments stale when their line content moves`. It turns a silent wrong answer into a visible stale comment, it's a few lines in one pure module, and it reuses the existing stale UI and prompt filtering. Records written before `lineContent` existed (`null`) keep today's behavior.

Do option 2 later, server-side in the Review Record layer, only once real use shows that shifted comments going stale is annoying. It touches the record shape, suggestions and the MCP output, so it deserves its own change and tests for ranges and duplicate lines.
