// what each keymap action does. thin: every handler calls a store method. reserved actions
// (comment, search, LSP) have no handler yet and dispatch nothing.

import type { AppState } from "$lib/state/context";
import { pagePosition } from "./pageMove";
import { selectedSearchText } from "./selectionText";
import type { ActionId } from "./types";

export type ActionHandler = (count: number | null) => void;

export interface ActionEnv {
  app: AppState;
  currentPath: () => string | undefined; // the file the reader is in (scroll-aware in all-files view)
  halfPageRows: () => number;
}

export function createActions({ app, currentPath, halfPageRows }: ActionEnv): Partial<Record<ActionId, ActionHandler>> {
  const { ui, prefs, diff, comments, analysis, cursor, search, searchAll } = app;
  const n = (count: number | null): number => count ?? 1;
  return {
    "line.next": (c) => cursor.lines(currentPath(), n(c)),
    "line.prev": (c) => cursor.lines(currentPath(), -n(c)),
    "file.next": (c) => cursor.files(currentPath(), n(c)),
    "file.prev": (c) => cursor.files(currentPath(), -n(c)),
    "hunk.next": (c) => cursor.hunks(currentPath(), n(c)),
    "hunk.prev": (c) => cursor.hunks(currentPath(), -n(c)),
    "goto.top": () => cursor.top(currentPath()),
    "goto.bottom": (c) => (c === null ? cursor.bottom(currentPath()) : cursor.lineNumber(currentPath(), c)),
    "page.down": (c) => cursor.page(currentPath(), () => pagePosition(1, n(c)), halfPageRows() * n(c)),
    "page.up": (c) => cursor.page(currentPath(), () => pagePosition(-1, n(c)), -halfPageRows() * n(c)),
    "side.old": () => cursor.switchTo(currentPath(), "old"),
    "side.new": () => cursor.switchTo(currentPath(), "new"),
    "jump.back": () => cursor.back(currentPath()),
    "jump.forward": () => cursor.forward(currentPath()),

    "search.file": () => {
      searchAll.close();
      search.start(currentPath(), selectedSearchText());
    },
    "search.all": () => {
      search.close();
      searchAll.start();
    },
    "search.next": (c) => search.next(n(c)),
    "search.prev": (c) => search.prev(n(c)),

    "review.viewed": () => {
      const path = currentPath();
      if (path) void comments.toggleViewed(path);
    },
    "review.preview": () => ui.openOverlay("compile"),
    "review.scorecard": () => {
      if (analysis.scorecard) ui.toggleOverlay("scorecard");
    },
    "view.order": () => prefs.setFileOrder(prefs.fileOrder === "review" ? "tree" : "review"),
    "view.theme": () => prefs.toggleTheme(),
    "view.split": () => prefs.toggleSplit(),
    "view.wrap": () => prefs.toggleWrap(),
    "view.files": () => prefs.setFileView(prefs.fileView === "single" ? "all" : "single"),
    "view.refresh": () => void diff.refresh(),
    "help.whatsNew": () => ui.toggleOverlay("whatsNew"),
    "help.keys": () => ui.toggleOverlay("help"),
  };
}
