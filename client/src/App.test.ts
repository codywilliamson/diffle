import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import { REVIEW_SCHEMA_VERSION, type DiffResult, type ReviewRecord } from "$types";
import App from "./App.svelte";
import { WHATS_NEW } from "$lib/whatsNew";

const diff: DiffResult = {
  ref: "feature/x → origin/main",
  files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 2, deletions: 1, hunks: [] }],
};

// git lists the root file first; the sidebar tree lists the src/ folder first.
const keyboardDiff: DiffResult = {
  ref: "feature/x → origin/main",
  files: [
    { path: "b.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [] },
    { path: "src/a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [] },
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

  it("supports tree-ordered file navigation, viewed state, and feedback preview shortcuts", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/diff") return jsonResponse(keyboardDiff, 200);
      if (path === "/api/comments") return jsonResponse({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed: [], comments: [] }, 200);
      if (path === "/api/state") return jsonResponse({ seenVersion: WHATS_NEW.version }, 200);
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

    await fireEvent.keyDown(window, { key: "J" });
    expect(document.querySelector('button[aria-current="true"]')).toHaveTextContent("b.ts");
    await fireEvent.keyDown(window, { key: "K" });
    expect(document.querySelector('button[aria-current="true"]')).toHaveTextContent("a.ts");

    await fireEvent.keyDown(window, { key: "v" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/viewed",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ viewed: ["src/a.ts"] }) }),
    ));

    await fireEvent.keyDown(window, { key: "P" });
    expect(await screen.findByRole("heading", { name: "Feedback preview" })).toBeInTheDocument();
    expect(await screen.findByText("compiled feedback")).toBeInTheDocument();
  });

  it("moves a line cursor with j and k and keeps it on its line across a refresh", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    globalThis.IntersectionObserver = class { observe(): void {} disconnect(): void {} unobserve(): void {} } as unknown as typeof IntersectionObserver;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const line = (n: number, text: string, type: "context" | "addition" = "context") =>
      ({ type, oldLine: type === "context" ? n : null, newLine: n, content: text });
    const body = (lines: ReturnType<typeof line>[]): DiffResult => ({
      ref: "HEAD",
      files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [{ header: "@@", lines }] }],
    });
    let current = body([line(1, "one"), line(2, "two"), line(3, "three", "addition")]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/diff") return jsonResponse(current, 200);
      if (path === "/api/comments") return jsonResponse({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed: [], comments: [] }, 200);
      if (path === "/api/state") return jsonResponse({ seenVersion: WHATS_NEW.version }, 200);
      return jsonResponse({}, 404);
    }));
    render(App);
    await screen.findByText(/1 file\b/);
    const cursorLine = (): string | null => document.querySelector("[data-cursor]")?.getAttribute("data-newline") ?? null;

    expect(cursorLine()).toBeNull();
    await fireEvent.keyDown(window, { key: "j" });
    await fireEvent.keyDown(window, { key: "j" });
    await waitFor(() => expect(cursorLine()).toBe("2"));
    expect(document.querySelector("[data-cursor]")).toHaveAttribute("aria-current", "location");
    await waitFor(() => expect(document.querySelector("[data-cursor-announcer]")).toHaveTextContent("a.ts line 2, new side"));
    await fireEvent.keyDown(window, { key: "1" });
    await fireEvent.keyDown(window, { key: "j" });
    await waitFor(() => expect(cursorLine()).toBe("3"));

    // a line is inserted above, so "three" is now line 4
    current = body([line(1, "one"), line(2, "new"), line(3, "two"), line(4, "three", "addition")]);
    await fireEvent.keyDown(window, { key: "r" });
    await waitFor(() => expect(cursorLine()).toBe("4"));
  });

  it("peels one Esc layer per press: a pending count first, then the open dialog", async () => {
    const animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    Element.prototype.animate = animate;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/diff") return jsonResponse(keyboardDiff, 200);
      if (path === "/api/comments") return jsonResponse({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed: [], comments: [] }, 200);
      if (path === "/api/state") return jsonResponse({ seenVersion: WHATS_NEW.version }, 200);
      return jsonResponse({}, 404);
    }));
    render(App);
    await screen.findByText(/2 files\b/);
    await fireEvent.keyDown(window, { key: "?" });
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    await fireEvent.keyDown(window, { key: "5" });
    const before = animate.mock.calls.length;
    await fireEvent.keyDown(window, { key: "Escape" });
    // the count absorbed the first Esc: no closing transition has started
    expect(animate.mock.calls.length).toBe(before);
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    await fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(animate.mock.calls.length).toBeGreaterThan(before));
  });

  describe("Esc layers with visual mode and the editor", () => {
    function setup(): void {
      Element.prototype.scrollIntoView = vi.fn();
      Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
      globalThis.IntersectionObserver = class { observe(): void {} disconnect(): void {} unobserve(): void {} } as unknown as typeof IntersectionObserver;
      vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
      const lines = [1, 2, 3].map((n) => ({ type: "context" as const, oldLine: n, newLine: n, content: `l${n}` }));
      const one: DiffResult = { ref: "HEAD", files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 1, deletions: 0, hunks: [{ header: "@@", lines }] }] };
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/diff") return jsonResponse(one, 200);
        if (path === "/api/comments") return jsonResponse({ meta: { ref: "HEAD", createdAt: "", updatedAt: "" }, viewed: [], comments: [] }, 200);
        if (path === "/api/state") return jsonResponse({ seenVersion: WHATS_NEW.version }, 200);
        return jsonResponse({}, 404);
      }));
    }
    const picked = (): number => document.querySelectorAll(".range-selected").length;

    it("closes the dialog first and leaves visual mode on the next Esc", async () => {
      setup();
      render(App);
      await screen.findByText(/1 file\b/);
      await fireEvent.keyDown(window, { key: "j" });
      await fireEvent.keyDown(window, { key: "V" });
      await waitFor(() => expect(picked()).toBe(1));
      await fireEvent.keyDown(window, { key: "?" });
      expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
      const before = (Element.prototype.animate as ReturnType<typeof vi.fn>).mock.calls.length;
      await fireEvent.keyDown(window, { key: "Escape" });
      // the dialog starts its closing transition; visual mode is untouched
      await waitFor(() => expect((Element.prototype.animate as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(before));
      expect(picked()).toBe(1);
      await fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => expect(picked()).toBe(0));
      await waitFor(() => expect(document.querySelector("[data-cursor-announcer]")).toHaveTextContent("visual cancelled"));
    });

    it.each(["c", "C", "V"])("%s does nothing behind an open dialog", async (key) => {
      setup();
      render(App);
      await screen.findByText(/1 file\b/);
      await fireEvent.keyDown(window, { key: "j" });
      await fireEvent.keyDown(window, { key: "?" });
      const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
      await fireEvent.keyDown(window, { key });
      expect(screen.queryByRole("textbox", { name: "Comment text" })).toBeNull();
      expect(picked()).toBe(0);
      expect(dialog).toBeInTheDocument();
    });

    it("announces the visual range as it grows", async () => {
      setup();
      render(App);
      await screen.findByText(/1 file\b/);
      await fireEvent.keyDown(window, { key: "j" });
      await fireEvent.keyDown(window, { key: "V" });
      await fireEvent.keyDown(window, { key: "j" });
      await waitFor(() => expect(document.querySelector("[data-cursor-announcer]")).toHaveTextContent("visual range, a.ts new lines 1 to 2"));
    });

    it("one Esc in the editor closes it and also clears a pending count", async () => {
      setup();
      render(App);
      await screen.findByText(/1 file\b/);
      await fireEvent.keyDown(window, { key: "j" });
      await fireEvent.keyDown(window, { key: "c" });
      const editor = await screen.findByRole("textbox", { name: "Comment text" });
      await fireEvent.keyDown(window, { key: "5" }); // a count typed outside the field
      await fireEvent.keyDown(editor, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("textbox", { name: "Comment text" })).toBeNull());
      await fireEvent.keyDown(window, { key: "j" });
      // 5j would have run to line 3; the count is gone, so j moves one line
      await waitFor(() => expect(document.querySelector("[data-cursor]")?.getAttribute("data-newline")).toBe("2"));
    });
  });

  it("expands the review menu into a modal that keeps the draft and renders the agent update", async () => {
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const withUpdate: ReviewRecord = {
      ...reviewRecord,
      activity: [{ id: "a1", type: "rereview_requested", actor: "agent", summary: "All **17** addressed", createdAt: "2026-01-01T00:00:00Z" }],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/diff") return jsonResponse(diff, 200);
      if (path === "/api/comments") return jsonResponse(withUpdate, 200);
      if (path === "/api/state") return jsonResponse({ seenVersion: WHATS_NEW.version }, 200);
      return jsonResponse({}, 404);
    }));
    render(App);
    await screen.findByText(/1 file\b/);

    await fireEvent.click(screen.getByRole("button", { name: /Review menu/i }));
    expect(screen.getByText("17").tagName).toBe("STRONG");
    await fireEvent.input(screen.getByRole("textbox", { name: "Reviewer summary" }), { target: { value: "Draft note" } });
    await fireEvent.click(screen.getByRole("button", { name: "Expand review" }));

    const dialog = await screen.findByRole("dialog", { name: /^Review —/ });
    expect(within(dialog).getByRole("textbox", { name: "Reviewer summary" })).toHaveValue("Draft note");
    expect(within(dialog).getByText("17").tagName).toBe("STRONG");
  });

  it("includes the review menu's draft summary in feedback preview", async () => {
    Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/diff") return jsonResponse(diff, 200);
      if (path === "/api/comments") return jsonResponse(reviewRecord, 200);
      if (path === "/api/state") return jsonResponse({ seenVersion: WHATS_NEW.version }, 200);
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
