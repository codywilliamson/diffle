// the text a reader has selected on the page, for prefilling a search: the first line only,
// trimmed, and nothing when it is empty or too long to be a search term.

export const MAX_PREFILL_CHARS = 200;

export function selectedSearchText(selection: Selection | null = window.getSelection()): string {
  const first = selection?.toString().split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  const text = first.trim();
  return text.length <= MAX_PREFILL_CHARS ? text : "";
}
