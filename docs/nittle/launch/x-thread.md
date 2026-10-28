# X thread draft

Draft for Cody. Nothing here has been posted. Five posts. Each names the screenshot it carries, from docs/nittle/launch/screenshots/ (see that folder's README for what each shot shows).

## 1/5

Your coding agent says it's done. Now you read the diff.

I built nittle for that step. Run `nittle` in a repo, comment on the exact lines, send the comments back to the agent, then check what it changed.

Runs locally, no account. https://nittle.dev

Screenshot: nittle-diff-with-comments.png

## 2/5

Comment on a line, a range or a whole file. Or never touch the mouse: j/k to move, V to select a range, c to comment, / to search, gd for the definition.

The comment carries the file, the line and the code around it. Your agent doesn't have to guess which retry loop you meant.

Screenshot: nittle-keyboard-shortcuts.png. Owner to capture a split view with a range comment if you want it instead.

## 3/5

Then it goes back to the agent. Copy the prompt, or let it travel over MCP:

    curl -fsSL https://nittle.dev/install | sh
    nittle setup

setup wires Claude Code, Codex, Cursor, Gemini CLI, VS Code, Windsurf, OpenCode, Zed and Copilot CLI. It shows the plan and asks first.

Screenshot: owner to capture (a terminal running `nittle setup`)

## 4/5

The agent replies in the thread, marks the comment addressed, and asks for another pass. You refresh the diff and see what it changed.

It's a loop. The agent answers, you check, and it goes around again.

Screenshot: nittle-core-loop.gif for the loop. Owner to capture an agent reply thread if you want a still.

## 5/5

Before you read a line, the scorecard tells you where to look: removed public API, missing tests, dependency bumps, hotspots. Fixed rules, no model in the loop.

Free, MIT, one binary. Used to be called diffle, which was a different project's name first. The first run moves your data over.

Screenshot: owner to capture (the scorecard). nittle-review-panel.png is the stand-in.
