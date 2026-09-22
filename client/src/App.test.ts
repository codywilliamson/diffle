import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import { REVIEW_SCHEMA_VERSION, type DiffResult, type ReviewRecord } from "$types";
import App from "./App.svelte";

const diff: DiffResult = {
  ref: "feature/x → origin/main",
  files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 2, deletions: 1, hunks: [] }],
};

const keyboardDiff: DiffResult = {
  ref: "feature/x → origin/main",
  files: [
    { path: "a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [] },
    { path: "b.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [] },
  ],
};

const reviewRecord: ReviewRecord = {
  schemaVersion: REVIEW_SCHEMA_VERSION,
  id: "r1",
  target: { cwd: "/repo", ref: "HEAD" },
  policy: "handoff",
  status: "awaiting_human",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  viewed: [],
  comments: [],
  activity: [],
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  delete (Element.prototype as Partial<Element>).animate;
});

describe("App shell", () => {
  it("shows a loading state before the diff resolves", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));
    render(App);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders the diff context after a successful load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(diff, 200)));
    render(App);
    expect(await screen.findByText("feature/x → origin/main")).toBeInTheDocument();
    expect(await screen.findByText(/1 file\b/)).toBeInTheDocument();
  });

  it("surfaces the server error text when the diff request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "git exploded" }, 500)));
    render(App);
    expect(await screen.findByRole("alert")).toHaveTextContent("git exploded");
  });

  it("supports file navigation, viewed state, and feedback preview shortcuts", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/diff") return jsonResponse(keyboardDiff, 200);
      if (path === "/api/comments") return jsonResponse({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed: [], comments: [] }, 200);
      if (path === "/api/state") return jsonResponse({ seenVersion: "0.16.0" }, 200);
      if (path === "/api/compile") return jsonResponse({ prompt: "compiled feedback" }, 200);
      if (path === "/api/viewed") {
        const viewed = JSON.parse(String(init?.body)).viewed as string[];
        return jsonResponse({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed, comments: [] }, 200);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(App);
    await screen.findByText(/2 files\b/);

    await fireEvent.keyDown(window, { key: "j" });
    expect(document.querySelector('button[aria-current="true"]')).toHaveTextContent("b.ts");
    await fireEvent.keyDown(window, { key: "k" });
    expect(document.querySelector('button[aria-current="true"]')).toHaveTextContent("a.ts");

    await fireEvent.keyDown(window, { key: "v" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/viewed",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ viewed: ["a.ts"] }) }),
    ));

    await fireEvent.keyDown(window, { key: "c" });
    expect(await screen.findByRole("heading", { name: "Feedback preview" })).toBeInTheDocument();
    expect(await screen.findByText("compiled feedback")).toBeInTheDocument();
  });

  it("includes the review menu's draft summary in feedback preview", async () => {
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/diff") return jsonResponse(diff, 200);
      if (path === "/api/comments") return jsonResponse(reviewRecord, 200);
      if (path === "/api/state") return jsonResponse({ seenVersion: "0.16.0" }, 200);
      if (path === "/api/compile?summary=Draft%20note") return jsonResponse({ prompt: "Draft note" }, 200);
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(App);
    await screen.findByText(/1 file\b/);

    await fireEvent.click(screen.getByRole("button", { name: /Review menu/i }));
    await fireEvent.input(screen.getByRole("textbox", { name: "Reviewer summary" }), { target: { value: "Draft note" } });
    await fireEvent.click(screen.getByRole("button", { name: "Preview feedback" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/compile?summary=Draft%20note",
      expect.any(Object),
    ));
    expect(await screen.findByText("Draft note")).toBeInTheDocument();
  });
});
