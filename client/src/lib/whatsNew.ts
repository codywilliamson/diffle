// what's-new highlights for the current release. auto-shown once per version the reviewer
// hasn't seen; the seen version persists server-side (state.json) via /api/state.

import { PRODUCT } from "$product";

const cmd = (args: string) => `"${PRODUCT.name} ${args}"`;

export const WHATS_NEW = {
  version: "0.28.0",
  highlights: [
    "New review scorecard (press g): size, tests, public API, dependency, hotspot and risk-flag bands for the change, each with the reasons behind it. It's fully deterministic, no AI involved, and C# is a first-class language.",
    "Review order (press m) groups files by project, puts dependencies first using csproj ProjectReferences, and follows each file with its test. Generated files and lockfiles go last.",
    "Generated files and lockfiles start collapsed, whitespace-only hunks are dimmed, and moved code is marked with links to where it came from or went.",
    "When an agent sends changes back after your feedback, files that changed show a \"Changed since last review\" chip and can show only what's new since your last round.",
  ],
};
