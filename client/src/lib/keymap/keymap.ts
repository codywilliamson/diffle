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
  bind("Ctrl+d", "Move", "Half a page down", "page.down", { count: true }),
  bind("Ctrl+u", "Move", "Half a page up", "page.up", { count: true }),
  bind("h", "Move", "Side-by-side: old side", "side.old"),
  bind("l", "Move", "Side-by-side: new side", "side.new"),
  bind("Ctrl+o", "Move", "Jump back", "jump.back"),
  bind("Ctrl+i", "Move", "Jump forward", "jump.forward"),

  bind("c", "Comment", "Comment on the line", "comment.line", { reserved: true }),
  bind("V", "Comment", "Start a visual range", "visual.start", { reserved: true }),
  bind("C", "Comment", "Comment on the file", "comment.file", { reserved: true }),

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

  bind("gd", "Code", "Go to definition", "code.definition", { reserved: true }),
  bind("gy", "Code", "Go to type definition", "code.typeDefinition", { reserved: true }),
  bind("gh", "Code", "Hover", "code.hover", { reserved: true }),
  bind("gr", "Code", "References", "code.references", { reserved: true }),
  bind("gs", "Code", "Document symbols", "code.symbols", { reserved: true }),
  bind("gS", "Code", "Workspace symbols", "code.workspaceSymbols", { reserved: true }),

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
