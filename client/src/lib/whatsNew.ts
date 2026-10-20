// what's-new highlights for the current release. auto-shown once per version the reviewer
// hasn't seen (bump `version` when a release adds highlights);
// the seen version persists server-side (state.json) via /api/state.

import { PRODUCT } from "$product";

const cmd = (args: string) => `"${PRODUCT.name} ${args}"`;

export const WHATS_NEW = {
  version: "0.29.0",
  highlights: [
    `Same app, new name: ${PRODUCT.name}, ${PRODUCT.lineage}. You do not need to do anything. The update moved your reviews, settings and agent plugin over, and the command is now ${PRODUCT.name}.`,
    `${PRODUCT.name} completion --shell zsh prints tab completion for commands, flags and branch names. Bash, zsh, fish and PowerShell are supported.`,
    `${PRODUCT.name} show reviews the last commit (or any commit with ${PRODUCT.name} show <rev>), with its message, author and hash above the files.`,
    `${PRODUCT.name} --wait opens a review and blocks until you send feedback, then prints the prompt on stdout. Any agent that can run a shell command can use it, no MCP needed.`,
    "New review scorecard (press gc): size, tests, public API, dependency, hotspot and risk-flag bands for the change, each with the reasons behind it. It's fully deterministic, no AI involved, and C# is a first-class language.",
    "Review order (press m) groups files by project, puts dependencies first using csproj ProjectReferences, and follows each file with its test. Generated files and lockfiles go last.",
    "Generated files and lockfiles start collapsed, whitespace-only hunks are dimmed, and moved code is marked with links to where it came from or went.",
    "When an agent sends changes back after your feedback, files that changed show a \"Changed since last review\" chip and can show only what's new since your last round.",
    "Keyboard review: j and k now move a line cursor (10j works), J and K move between files, ] and [ jump hunks, gg and G go to the top and bottom, Ctrl+o jumps back. Moved keys: scorecard is now gc, feedback preview is now P, What's new is now gw.",
    "Comment from the keyboard: c on the cursor line, V then j or k then c for a range, C for the whole file.",
    "Act on comments from the keyboard: e edits the comment on the cursor line, dd deletes it, R resolves or reopens it, yy copies it (or the line when there is no comment), and { and } step between several on one line.",
    "Search the current file with /: matches are highlighted on both sides, n and N step through them, Esc clears.",
    "Search every changed file with g/: hits are grouped by file, Enter jumps to the line, Ctrl+o comes back.",
    "Suggest a change: in a line or range comment, Suggest change inserts the lines to edit. Agents get the original and suggested text as structured data.",
    "Code navigation: gd goes to a definition, gh shows hover docs, gA lists references, gs and gS search symbols. Needs a language server installed (TypeScript and C# today).",
  ],
};
