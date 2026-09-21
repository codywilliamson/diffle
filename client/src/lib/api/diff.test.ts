import { describe, it, expect, vi, afterEach } from "vitest";
import type { DiffResult } from "$types";
import { getDiff } from "./diff";

const sampleDiff: DiffResult = {
  ref: "working tree",
  files: [],
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("getDiff", () => {
  it("requests /api/diff and returns the parsed DiffResult", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(sampleDiff, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDiff();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/diff");
    expect(result).toEqual(sampleDiff);
  });

  it("forwards an abort signal to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(sampleDiff, 200));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await getDiff(controller.signal);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });

  it("throws the server's error text on a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "invalid path" }, 400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDiff()).rejects.toThrow("invalid path");
  });

  it("falls back to the status when the error body has no text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDiff()).rejects.toThrow("500");
  });
});
