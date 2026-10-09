import { describe, expect, it } from "vitest";
import type { ReviewScorecard } from "$types";
import { createAnalysisStore } from "./analysis.svelte";

const card = (): ReviewScorecard => ({ files: [], moved: [], groups: [] }) as unknown as ReviewScorecard;

describe("analysis store", () => {
  it("stores the fetched scorecard", async () => {
    const store = createAnalysisStore({ getScorecard: async () => card() });
    await store.refresh();
    expect(store.scorecard).not.toBeNull();
  });

  it("clears the scorecard when a refresh fails so stale marks cannot land on new lines", async () => {
    let fail = false;
    const store = createAnalysisStore({ getScorecard: async () => { if (fail) throw new Error("boom"); return card(); } });
    await store.refresh();
    fail = true;
    await store.refresh();
    expect(store.scorecard).toBeNull();
  });

  it("keeps the scorecard when the request was aborted", async () => {
    let abort = false;
    const store = createAnalysisStore({
      getScorecard: async () => { if (abort) throw new DOMException("aborted", "AbortError"); return card(); },
    });
    await store.refresh();
    abort = true;
    await store.refresh();
    expect(store.scorecard).not.toBeNull();
  });
});
