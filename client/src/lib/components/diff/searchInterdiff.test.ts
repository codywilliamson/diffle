import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiffResult, FileAnalysis, ReviewScorecard } from "$types";
import App from "../../../App.svelte";
import { WHATS_NEW } from "$lib/whatsNew";
import { INTERDIFF_NOTICE } from "$lib/state/search.svelte";

const diff: DiffResult = {
  ref: "HEAD",
  files: [
    {
      path: "a.ts", oldPath: null, changeType: "modified", additions: 0, deletions: 0,
      hunks: [{ header: "@@", lines: [{ type: "context", oldLine: 1, newLine: 1, content: "needle here" }] }],
    },
  ],
};

const analysis: FileAnalysis = {
  path: "a.ts", language: "typescript", group: "g", noise: null, whitespaceOnlyHunks: [], noiseLines: 0,
  effectiveLines: 1, testPair: null, isTest: false, churn: 0, changedSinceReview: true, flags: [],
};

const scorecard: ReviewScorecard = {
  totals: { files: 1, additions: 0, deletions: 0, effectiveLines: 1, noiseLines: 0 },
  categories: [],
  groups: [{ id: "g", label: "Core", files: ["a.ts"] }],
  files: [analysis],
  moved: [],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  delete (Element.prototype as Partial<Element>).animate;
});

describe("search and the changes-since-last-review view", () => {
  it("closes open search when the view is switched on and refuses to reopen it there", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    globalThis.IntersectionObserver = class { observe(): void {} disconnect(): void {} unobserve(): void {} } as unknown as typeof IntersectionObserver;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/diff") return json(diff);
      if (path === "/api/scorecard") return json(scorecard);
      if (path.startsWith("/api/interdiff")) return json({ file: null });
      if (path === "/api/state") return json({ seenVersion: WHATS_NEW.version });
      if (path === "/api/comments") return json({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed: [], comments: [] });
      return json({}, 404);
    }));
    render(App);
    const toggle = await screen.findByRole("button", { name: "Show only changes since last review" });

    await fireEvent.keyDown(window, { key: "/" });
    expect(await screen.findByRole("textbox", { name: "Search this file" })).toBeInTheDocument();

    await fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Search this file" })).toBeNull());

    await fireEvent.keyDown(window, { key: "/" });
    expect(await screen.findByText(INTERDIFF_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search this file" })).toBeNull();

    // leaving the view brings search back
    await fireEvent.click(screen.getByRole("button", { name: "Showing changes since review" }));
    await fireEvent.keyDown(window, { key: "/" });
    expect(await screen.findByRole("textbox", { name: "Search this file" })).toBeInTheDocument();
  });
});
