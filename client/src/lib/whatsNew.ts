// what's-new highlights for the current release. auto-shown once per version the reviewer
// hasn't seen (bump `version` when a release adds highlights);
// the seen version persists server-side (state.json) via /api/state.

import { PRODUCT } from "$product";

const cmd = (args: string) => `"${PRODUCT.name} ${args}"`;

export const WHATS_NEW = {
  version: "0.29.0",
  highlights: [
    `Same app, new name: ${PRODUCT.name}, ${PRODUCT.lineage}. You do not need to do anything. The update moved your reviews, settings and agent plugin over, and the command is now ${PRODUCT.name}.`,
    `${PRODUCT.name} show reviews the last commit (or any commit with ${PRODUCT.name} show <rev>), with its message, author and hash above the files.`,
    `${PRODUCT.name} --wait opens a review and blocks until you send feedback, then prints the prompt on stdout. Any agent that can run a shell command can use it, no MCP needed.`,
    "New review scorecard (press gc): size, tests, public API, dependency, hotspot and risk-flag bands for the change, each with the reasons behind it. It's fully deterministic, no AI involved, and C# is a first-class language.",
    "Review order (press m) groups files by project, puts dependencies first using csproj ProjectReferences, and follows each file with its test. Generated files and lockfiles go last.",
    "Generated files and lockfiles start collapsed, whitespace-only hunks are dimmed, and moved code is marked with links to where it came from or went.",
    "When an agent sends changes back after your feedback, files that changed show a \"Changed since last review\" chip and can show only what's new since your last round.",
    "Keyboard review: j and k now move a line cursor (10j works), J and K move between files, ] and [ jump hunks, gg and G go to the top and bottom, Ctrl+o jumps back. Moved keys: scorecard is now gc, feedback preview is now P, What's new is now gw.",
    "Search the current file with /: matches are highlighted on both sides, n and N step through them, Esc clears.",
  ],
};
