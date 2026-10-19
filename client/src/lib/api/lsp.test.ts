import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "./http";
import { lspDefinition, lspErrorOf, lspHover, lspMessage, lspWorkspaceSymbols } from "./lsp";

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("lsp api", () => {
  it("posts the position with the kind and this tab's client id", async () => {
    const fetchMock = stubFetch(200, { targets: [], onDefinition: false });
    await lspDefinition({ path: "a.ts", side: "new", line: 3, character: 7 }, "typeDefinition");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/lsp/definition");
    expect(JSON.parse(init.body)).toEqual({ path: "a.ts", side: "new", line: 3, character: 7, kind: "typeDefinition" });
    expect(init.headers["x-client-id"]).toMatch(/\S+/);
  });

  it("sends the same client id on every request, so the server can supersede a hover", async () => {
    const fetchMock = stubFetch(200, { contents: "" });
    await lspHover({ path: "a.ts", side: "new", line: 1, character: 0 });
    await lspHover({ path: "a.ts", side: "new", line: 1, character: 1 });
    expect(fetchMock.mock.calls[0]![1].headers["x-client-id"]).toBe(fetchMock.mock.calls[1]![1].headers["x-client-id"]);
  });

  it("encodes the workspace query", async () => {
    const fetchMock = stubFetch(200, { symbols: [], total: 0, truncated: false });
    await lspWorkspaceSymbols("a b&c");
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/lsp/symbols?query=a%20b%26c");
  });

  it("keeps the lsp envelope on a failed request", async () => {
    stubFetch(409, { error: "typescript language server is missing", code: "server-unavailable", state: "missing", hint: "npm i -g typescript-language-server" });
    const error = await lspDefinition({ path: "a.ts", side: "new", line: 1, character: 0 }, "definition").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(lspErrorOf(error)).toMatchObject({ code: "server-unavailable", state: "missing" });
    expect(lspMessage(error)).toBe("npm i -g typescript-language-server");
  });

  it("falls back to the message when there is no hint, or no envelope", () => {
    expect(lspMessage(new ApiRequestError("boom", 502, { error: "boom", code: "request-failed" }))).toBe("boom");
    expect(lspMessage(new Error("offline"))).toBe("offline");
    expect(lspErrorOf(new ApiRequestError("x", 500, null))).toBeNull();
  });
});
