import { render, screen } from "@testing-library/svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { DiffResult } from "$types";
import App from "./App.svelte";

const diff: DiffResult = {
  ref: "feature/x → origin/main",
  files: [{ path: "a.ts", oldPath: null, changeType: "modified", additions: 2, deletions: 1, hunks: [] }],
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

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
});
