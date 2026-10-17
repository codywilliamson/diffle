// shared shapes for the keymap: the binding table, the parser's input and its outcomes.

export type Mode = "normal" | "visual" | "search";
export type BindingMode = Mode | "any";
export type Group = "Move" | "Comment" | "Search" | "View" | "Review" | "Code" | "Help";

export type ActionId =
  | "line.next" | "line.prev" | "file.next" | "file.prev" | "hunk.next" | "hunk.prev"
  | "goto.top" | "goto.bottom" | "page.down" | "page.up"
  | "side.old" | "side.new" | "jump.back" | "jump.forward"
  | "comment.line" | "visual.start" | "comment.range" | "comment.file"
  | "search.file" | "search.next" | "search.prev" | "search.all"
  | "review.viewed" | "review.preview" | "review.scorecard"
  | "view.order" | "view.theme" | "view.split" | "view.wrap" | "view.files" | "view.refresh"
  | "help.whatsNew" | "help.keys" | "escape"
  | "code.definition" | "code.typeDefinition" | "code.hover" | "code.references" | "code.symbols" | "code.workspaceSymbols";

export interface Binding {
  keys: string; // "j", "gg", "]", "Ctrl+d"
  mode: BindingMode;
  group: Group;
  label: string;
  count: boolean; // a numeric prefix is meaningful
  action: ActionId;
  reserved?: true; // known to the parser, dispatches nothing yet and is hidden from help
}

// the slice of a keyboard event the parser needs, so it stays pure.
export interface KeyInput {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  altGraph: boolean; // AltGraph modifier active (some layouts type ] and friends with it)
  meta: boolean;
  editable: boolean;
}

export interface ParserState {
  count: string; // digits typed so far
  prefix: string | null; // pending chord prefix
  at: number; // clock time of the last accepted pending key
}

export type Outcome =
  | { kind: "dispatch"; binding: Binding; count: number | null }
  | { kind: "pending" } // count digit or chord prefix swallowed
  | { kind: "cancelled" } // Esc dropped a pending count or chord
  | { kind: "escape" } // Esc with nothing pending: leave the mode, then close the overlay
  | { kind: "dropped" } // unknown key after a prefix or count, swallowed
  | { kind: "ignored" }; // not for the keymap at all
