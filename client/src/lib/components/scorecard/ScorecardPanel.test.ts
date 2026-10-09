import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiffResult, FileAnalysis, ReviewScorecard } from "$types";
import App from "../../../App.svelte";
import { WHATS_NEW } from "$lib/whatsNew";

const diff: DiffResult = {
  ref: "feature/x",
  files: [
    { path: "b.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [] },
    { path: "src/a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [] },
  ],
};

const analysisFor = (path: string, over: Partial<FileAnalysis> = {}): FileAnalysis => ({
  path, language: "typescript", group: "g", noise: null, whitespaceOnlyHunks: [], noiseLines: 0,
  effectiveLines: 1, testPair: null, isTest: false, churn: 0, changedSinceReview: null, flags: [], ...over,
});

const scorecard: ReviewScorecard = {
  totals: { files: 2, additions: 2, deletions: 0, effectiveLines: 412, noiseLines: 230 },
  categories: [
    { id: "size", label: "Size", band: "low", summary: "412 effective lines across 2 files", reasons: [] },
    { id: "api", label: "Public API", band: "high", summary: "1 public member removed", reasons: ["Foo.Bar was removed"] },
  ],
  groups: [{ id: "g", label: "Core", files: ["src/a.ts", "b.ts"] }],
  files: [
    analysisFor("src/a.ts", { churn: 3, changedSinceReview: true, flags: [{ kind: "public-api-removed", reason: "Foo.Bar was removed" }] }),
    analysisFor("b.ts", { isTest: true }),
  ],
  moved: [],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function stubApi(card: ReviewScorecard | null) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/api/diff") return json(diff);
    if (path === "/api/scorecard") return card ? json(card) : json({ error: "no" }, 404);
    if (path === "/api/state") return json({ seenVersion: WHATS_NEW.version });
    if (path === "/api/comments") return json({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed: [], comments: [] });
    return json({}, 404);
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe("scorecard ui", () => {
  it("hides the trigger when there is no scorecard", async () => {
    stubApi(null);
    render(App);
    await screen.findByText(/2 files\b/);
    expect(screen.queryByRole("button", { name: /review scorecard/i })).toBeNull();
  });

  it("opens the panel, shows totals, categories and flagged files, and jumps to a file", async () => {
    stubApi(scorecard);
    render(App);
    await fireEvent.click(await screen.findByRole("button", { name: /review scorecard/i }));
    const dialog = await screen.findByRole("dialog", { name: "Review scorecard" });
    expect(within(dialog).getByTestId("scorecard-totals")).toHaveTextContent("412 effective lines · 2 files · 230 noise lines hidden");
    expect(within(dialog).getByText("High")).toBeInTheDocument();
    expect(within(dialog).getByText("3 recent commits")).toBeInTheDocument();
    expect(within(dialog).getByText("Changed since last review")).toBeInTheDocument();
    await fireEvent.click(within(dialog).getByRole("button", { name: /Foo\.Bar was removed/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Review scorecard" })).toBeNull());
  });

  it("g toggles the panel", async () => {
    stubApi(scorecard);
    render(App);
    await screen.findByRole("button", { name: /review scorecard/i });
    await fireEvent.keyDown(window, { key: "g" });
    expect(await screen.findByRole("dialog", { name: "Review scorecard" })).toBeInTheDocument();
  });

  it("review order lists scorecard groups flat with indicators", async () => {
    stubApi(scorecard);
    render(App);
    await screen.findByRole("button", { name: /review scorecard/i });
    await fireEvent.click(screen.getByRole("button", { name: "Review order" }));
    const nav = screen.getByRole("navigation", { name: "Changed files" });
    expect(within(nav).getByText("Core")).toBeInTheDocument();
    const rows = [...nav.querySelectorAll("button.text-left")].map((n) => n.textContent ?? "");
    expect(rows[0]).toContain("a.ts");
    expect(rows[0]).toContain("src");
    expect(rows[1]).toContain("b.ts");
    expect(within(nav).getByRole("img", { name: /High risk flag/ })).toBeInTheDocument();
    expect(within(nav).getByText("test")).toBeInTheDocument();
  });
});
