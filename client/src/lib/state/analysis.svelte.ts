import type { FileAnalysis, ReviewScorecard } from "$types";
import { getScorecard } from "$lib/api/analysis";

type Deps = { getScorecard: (signal?: AbortSignal) => Promise<ReviewScorecard> };

// the scorecard is a best-effort enhancement and never blocks the diff. a failed fetch clears it, since
// line/hunk-keyed marks from the old diff would land on the wrong lines; aborts (superseded) are ignored. refresh() is called whenever the diff reloads.
export function createAnalysisStore(deps: Deps = { getScorecard }) {
  let scorecard = $state<ReviewScorecard | null>(null);
  let inflight: AbortController | null = null;
  const byPath = $derived(new Map<string, FileAnalysis>((scorecard?.files ?? []).map((f) => [f.path, f])));

  return {
    get scorecard(): ReviewScorecard | null {
      return scorecard;
    },
    fileFor(path: string): FileAnalysis | undefined {
      return byPath.get(path);
    },
    async refresh(): Promise<void> {
      inflight?.abort();
      inflight = new AbortController();
      try {
        scorecard = await deps.getScorecard(inflight.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        scorecard = null;
      }
    },
  };
}

export type AnalysisStore = ReturnType<typeof createAnalysisStore>;
