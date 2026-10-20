// the single source of truth for keyboard bindings: the parser, dispatcher, help overlay,
// README and tests all read this table. grammar: [count] key or [count] prefix key.

import type { Binding, Group } from "./types";

export const CHORD_TIMEOUT_MS = 1000;
export const MAX_COUNT = 9999;
export const JUMP_HISTORY_CAP = 100;
export const GROUP_ORDER: Group[] = ["Move", "Comment", "Search", "View", "Review", "Code", "Help"];

interface Options {
  count?: boolean;
  reserved?: true;
  mode?: Binding["mode"];
}

const bind = (keys: string, group: Group, label: string, action: Binding["action"], opts: Options = {}): Binding => ({
  keys,
  group,
  label,
  action,
  count: opts.count ?? false,
  mode: opts.mode ?? "normal",
  ...(opts.reserved ? { reserved: true as const } : {}),
});

export const BINDINGS: Binding[] = [
  bind("j", "Move", "Next line", "line.next", { count: true }),
  bind("k", "Move", "Previous line", "line.prev", { count: true }),
  bind("J", "Move", "Next file", "file.next", { count: true }),
  bind("K", "Move", "Previous file", "file.prev", { count: true }),
  bind("]", "Move", "Next hunk", "hunk.next", { count: true }),
  bind("[", "Move", "Previous hunk", "hunk.prev", { count: true }),
  bind("gg", "Move", "First line of the file", "goto.top"),
  bind("G", "Move", "Last line of the file, or line N with a count", "goto.bottom", { count: true }),
  bind("gf", "Move", "Go to the file path on the cursor line", "file.goto"),
  bind("zo", "Move", "Expand the current file", "fold.open"),
  bind("zc", "Move", "Collapse the current file", "fold.close"),
  bind("zO", "Move", "Expand every file", "fold.openAll"),
  bind("zC", "Move", "Collapse every file", "fold.closeAll"),
  bind("Ctrl+d", "Move", "Half a page down", "page.down", { count: true }),
  bind("Ctrl+u", "Move", "Half a page up", "page.up", { count: true }),
  bind("h", "Move", "Side-by-side: old side", "side.old"),
  bind("l", "Move", "Side-by-side: new side", "side.new"),
  bind("Ctrl+o", "Move", "Jump back", "jump.back"),
  bind("Ctrl+i", "Move", "Jump forward", "jump.forward"),

  bind("c", "Comment", "Comment on the cursor line", "comment.line"),
  bind("V", "Comment", "Start a visual range (j k ] [ extend it, Esc cancels)", "visual.start"),
  bind("c", "Comment", "Visual range: comment on the range", "comment.range", { mode: "visual" }),
  bind("C", "Comment", "Comment on the cursor's file", "comment.file"),
  bind("gv", "Comment", "Reselect the last visual range", "visual.reselect"),
  bind("e", "Comment", "Edit the comment on the cursor line", "comment.edit"),
  bind("dd", "Comment", "Delete the comment on the cursor line", "comment.delete"),
  bind("u", "Comment", "Undo the last comment delete (offered for 8 seconds)", "comment.undo"),
  bind("R", "Comment", "Resolve or reopen that comment", "comment.resolve"),
  bind("yy", "Comment", "Copy that comment, or the cursor line when it has none", "comment.copy"),
  bind("}", "Comment", "Next comment on the cursor line", "comment.next"),
  bind("{", "Comment", "Previous comment on the cursor line", "comment.prev"),

  bind("Ctrl+p", "Search", "Go to a changed file (fuzzy)", "file.pick"),
  bind("/", "Search", "Search the file", "search.file"),
  bind("n", "Search", "Next match", "search.next", { count: true }),
  bind("N", "Search", "Previous match", "search.prev", { count: true }),
  bind("g/", "Search", "Search all changed files", "search.all"),

  bind("m", "View", "File list: tree / review order", "view.order"),
  bind("t", "View", "Light / dark theme", "view.theme"),
  bind("s", "View", "Side-by-side / unified", "view.split"),
  bind("w", "View", "Wrap long lines", "view.wrap"),
  bind("o", "View", "Single-file / all files", "view.files"),
  bind("r", "View", "Re-run the diff", "view.refresh"),

  bind("v", "Review", "Toggle viewed on the file", "review.viewed"),
  bind("P", "Review", "Preview review feedback", "review.preview"),
  bind("gc", "Review", "Open the review scorecard", "review.scorecard"),

  bind("gd", "Code", "Go to definition (on a definition: list references)", "code.definition"),
  bind("gy", "Code", "Go to type definition", "code.typeDefinition"),
  bind("gh", "Code", "Hover docs for the cursor word", "code.hover"),
  bind("gA", "Code", "List references", "code.references"),
  bind("gs", "Code", "Symbols in this file", "code.symbols"),
  bind("gS", "Code", "Symbols in the repository", "code.workspaceSymbols"),

  bind("gw", "Help", "What's new", "help.whatsNew"),
  bind("?", "Help", "Keyboard help", "help.keys", { mode: "any" }),
  bind("Esc", "Help", "Cancel a count or chord, leave the mode, close the overlay", "escape", { mode: "any" }),
];

export interface HelpGroup {
  group: Group;
  bindings: Binding[];
}

// what the help overlay shows: non-reserved bindings, grouped, in table order.
export function helpGroups(table: Binding[] = BINDINGS): HelpGroup[] {
  return GROUP_ORDER.map((group) => ({ group, bindings: table.filter((x) => x.group === group && !x.reserved) })).filter(
    (g) => g.bindings.length > 0,
  );
}
