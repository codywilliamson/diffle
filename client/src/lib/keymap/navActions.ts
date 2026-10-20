// navigation keys beyond the line cursor: gf, the file picker, folding files, gv.

import type { SearchHit } from "$types";
import type { AppState } from "$lib/state/context";
import { pathInLine } from "$lib/diff/pathInLine";
import type { ActionHandler } from "./actions";
import type { ActionId } from "./types";

export const NO_PATH_NOTICE = "No changed file path on this line.";
export const NO_RANGE_NOTICE = "No earlier visual range to reselect.";

type NavActionId = Extract<ActionId, "file.goto" | "file.pick" | "fold.open" | "fold.close" | "fold.openAll" | "fold.closeAll" | "visual.reselect">;

// a hit that lands on the nearest diff line of `path`, for a path written with a :line suffix
const lineHit = (path: string, line: number): SearchHit => ({ path, side: "new", line, preview: "", ranges: [] });

export function createNavActions(
  { ui, cursor, diff, filePicker, lsp }: AppState,
  currentPath: () => string | undefined,
): Record<NavActionId, ActionHandler> {
  const collapse = (path: string | null): void => {
    ui.requestFold(path, true);
    cursor.park(currentPath());
  };

  return {
    "file.goto": () => {
      const from = currentPath();
      const text = cursor.lineText();
      const hit = from && text ? pathInLine(text, from, diff.files.map((f) => f.path)) : null;
      if (!hit) return lsp.notify(NO_PATH_NOTICE);
      if ("ambiguous" in hit) {
        lsp.notify(`${hit.ambiguous.length} changed files match "${hit.query}". Pick one.`);
        return filePicker.show(hit.query);
      }
      if (hit.line === null) cursor.goToFile(hit.path);
      else cursor.goToHit(lineHit(hit.path, hit.line));
    },
    "file.pick": () => {
      lsp.closeTopmost();
      filePicker.show();
    },
    "fold.open": () => {
      const path = currentPath();
      if (path) ui.requestFold(path, false);
    },
    "fold.close": () => {
      const path = currentPath();
      if (path) collapse(path);
    },
    "fold.openAll": () => ui.requestFold(null, false),
    "fold.closeAll": () => collapse(null),
    "visual.reselect": () => {
      if (!cursor.reselectVisual()) lsp.notify(NO_RANGE_NOTICE);
    },
  };
}
