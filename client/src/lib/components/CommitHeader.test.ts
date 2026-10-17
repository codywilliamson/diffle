import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitInfo } from "$types";
import CommitHeader from "./CommitHeader.svelte";

const commit: CommitInfo = {
  hash: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  shortHash: "a1b2c3d",
  subject: "fix the parser",
  body: "first line\nsecond line",
  author: "Ada",
  date: "2026-10-17T12:00:00+00:00",
  isMerge: false,
  baseShortHash: "9f8e7d6",
};

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

describe("CommitHeader", () => {
  it("shows hash, subject, body with line breaks, and author", () => {
    const { container } = render(CommitHeader, { commit });
    expect(screen.getByText("fix the parser")).toBeInTheDocument();
    expect(screen.getByText("a1b2c3d")).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
    const body = container.querySelector("p.whitespace-pre-wrap");
    expect(body?.textContent).toBe("first line\nsecond line");
  });

  it("copies the full hash", async () => {
    render(CommitHeader, { commit });
    await fireEvent.click(screen.getByRole("button", { name: /copy commit hash/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(commit.hash));
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("says a merge is shown against its first parent", () => {
    render(CommitHeader, { commit: { ...commit, isMerge: true } });
    expect(screen.getByText("merge, showing changes against first parent 9f8e7d6")).toBeInTheDocument();
  });

  it("notes a root commit and omits an empty body", () => {
    const { container } = render(CommitHeader, { commit: { ...commit, body: "", baseShortHash: null } });
    expect(screen.getByText(/root commit/)).toBeInTheDocument();
    expect(container.querySelector("p.whitespace-pre-wrap")).toBeNull();
  });
});
