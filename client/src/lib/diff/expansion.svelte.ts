// per-file context expansion: loads the new-side text once the file renders, keeps the reader's
// reveals across diff refreshes while the hunks stay the same, and always reveals the hidden
// lines a new-side comment sits on (so a comment on an expanded line never disappears).

import type { Comment, DiffFile } from "$types";
import { getFile } from "$lib/api/meta";
import {
  expandFile, gapsOf, matchesText, mergeReveals, nextReveal, revealsFor, splitLines,
  type Gap, type GapView, type Reveal, type RevealHow,
} from "./expand";

export interface ExpansionControls {
  views: GapView[];
  reveal(gap: number, how: RevealHow): void;
  // the line was hidden by git. old-side comments anchor only to hunk lines, so a revealed line
  // takes comments on the new side alone.
  revealed(newLine: number): boolean;
}

const signatureOf = (file: DiffFile) => `${file.path}\n${file.hunks.map((h) => h.header).join("\n")}`;

export function createExpansion(current: () => DiffFile, enabled: () => boolean, comments: () => Comment[]) {
  // kept per path, so a refresh keeps revealed rows (and an open editor on one) while the text
  // reloads; text that no longer matches the diff is never shown.
  let text = $state.raw<{ path: string; lines: string[] } | null>(null);
  let user = $state.raw<{ signature: string; reveals: Map<number, Reveal> }>({ signature: "", reveals: new Map() });

  $effect(() => {
    const file = current();
    if (!enabled()) return;
    const controller = new AbortController();
    getFile(file.path, controller.signal).then(
      (response) => {
        if (!controller.signal.aborted) text = { path: file.path, lines: splitLines(response.content) };
      },
      () => {},
    );
    return () => controller.abort();
  });

  // the commented new-side ranges as a string: the review poll hands back fresh comment objects
  // every few seconds, and an unchanged string stops the rebuild below — a rebuilt file means
  // new line objects, which re-run syntax highlighting and flash the code.
  const anchorKey = $derived(
    JSON.stringify(
      comments()
        .filter((c) => c.file === current().path && c.line != null && (c.side ?? "new") === "new")
        .map((c) => [c.line as number, c.endLine ?? (c.line as number)]),
    ),
  );

  const state = $derived.by((): { file: DiffFile; gaps: Gap[]; views: GapView[]; reveals: Map<number, Reveal> } | null => {
    const file = current();
    if (!enabled() || text?.path !== file.path || !matchesText(file, text.lines)) return null;
    const gaps = gapsOf(file, text.lines.length);
    if (!gaps) return null;
    const anchors = (JSON.parse(anchorKey) as [number, number][]).map(([start, end]) => ({ start, end }));
    const own = user.signature === signatureOf(file) ? user.reveals : new Map<number, Reveal>();
    const reveals = mergeReveals(own, revealsFor(gaps, anchors));
    const expanded = expandFile(file, gaps, text.lines, reveals);
    return { file: expanded.file, gaps, views: expanded.views, reveals };
  });

  function reveal(gap: number, how: RevealHow): void {
    const s = state;
    const target = s?.gaps[gap];
    if (!s || !target) return;
    const next = new Map(s.reveals);
    next.set(gap, nextReveal(target, s.reveals.get(gap) ?? { top: 0, bottom: 0 }, how));
    user = { signature: signatureOf(current()), reveals: next };
  }

  return {
    get file(): DiffFile {
      return state?.file ?? current();
    },
    get controls(): ExpansionControls | undefined {
      const s = state;
      if (!s) return undefined;
      const revealed = (n: number) => s.gaps.some((gap) => n >= gap.start && n <= gap.end);
      return { views: s.views, reveal, revealed };
    },
  };
}
