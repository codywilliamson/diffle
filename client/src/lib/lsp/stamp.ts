// "where the reader is", as a list of values that change whenever they navigate: the cursor's
// reveal counter (every cursor move, search step, search-hit jump and diff reconcile bumps it) and
// the selected file plus its scroll request (sidebar picks). a slow definition answer is only
// acted on if this is unchanged since the request started.

export function navigationStamp(
  cursor: { revealSeq: number },
  ui: { activeFile: string | null; scrollRequest: object | null },
): readonly unknown[] {
  return [cursor.revealSeq, ui.activeFile, ui.scrollRequest];
}

export function sameStamp(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}
