import type { DiffFile, DiffLine } from "$types";
import { getFile } from "$lib/api/meta";
import { escapeHtml } from "./html";
import { highlightFile, needsFileText, type LineHtml } from "./highlight";

// new-side text for seeding hunk context; null when not needed or unavailable (highlighting
// still works, just without the file's leading context).
function loadText(file: DiffFile, signal: AbortSignal): Promise<string | null> {
  if (!needsFileText(file)) return Promise.resolve(null);
  return getFile(file.path, signal).then((r) => r.content, () => null);
}

// reactive per-line html for the current file: escaped plain text until its highlight lands.
export function createFileHighlight(current: () => DiffFile): (line: DiffLine) => string {
  let result = $state.raw<{ file: DiffFile; html: LineHtml } | null>(null);

  $effect(() => {
    const file = current();
    const controller = new AbortController();
    loadText(file, controller.signal)
      .then((text) => highlightFile(file, text))
      .then((html) => {
        if (!controller.signal.aborted) result = { file, html };
      })
      .catch(() => {});
    return () => controller.abort();
  });

  return (line) => (result?.file === current() ? result.html.get(line) : undefined) ?? escapeHtml(line.content);
}
