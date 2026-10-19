// typed adapters for the language-server routes. every request carries this tab's client id, so
// the server keeps at most one live hover per tab.

import type {
  LspDefinitionKind, LspDefinitionResponse, LspDocumentSymbolsResponse, LspErrorResponse, LspFileResponse,
  LspHoverResponse, LspPositionRequest, LspReferencesResponse, LspStatusResponse, LspWorkspaceSymbolsResponse,
} from "$types";
import { apiGet, apiPost, ApiRequestError } from "./http";

const CLIENT_HEADER = "x-client-id";
const clientId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
const headers = { [CLIENT_HEADER]: clientId };

export const lspDefinition = (request: LspPositionRequest, kind: LspDefinitionKind, signal?: AbortSignal) =>
  apiPost<LspDefinitionResponse>("/api/lsp/definition", { ...request, kind }, signal, headers);

export const lspHover = (request: LspPositionRequest, signal?: AbortSignal) =>
  apiPost<LspHoverResponse>("/api/lsp/hover", request, signal, headers);

export const lspReferences = (request: LspPositionRequest, signal?: AbortSignal) =>
  apiPost<LspReferencesResponse>("/api/lsp/references", request, signal, headers);

export const lspDocumentSymbols = (path: string, signal?: AbortSignal) =>
  apiGet<LspDocumentSymbolsResponse>(`/api/lsp/symbols?path=${encodeURIComponent(path)}`, signal, headers);

export const lspWorkspaceSymbols = (query: string, signal?: AbortSignal) =>
  apiGet<LspWorkspaceSymbolsResponse>(`/api/lsp/symbols?query=${encodeURIComponent(query)}`, signal, headers);

export const lspFile = (uri: string, signal?: AbortSignal) =>
  apiGet<LspFileResponse>(`/api/lsp/file?uri=${encodeURIComponent(uri)}`, signal, headers);

export const lspStatus = (signal?: AbortSignal) => apiGet<LspStatusResponse>("/api/lsp/status", signal, headers);

export const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

// the lsp error envelope behind a failed request, when the server sent one
export function lspErrorOf(error: unknown): LspErrorResponse | null {
  if (!(error instanceof ApiRequestError)) return null;
  const body = error.body as Partial<LspErrorResponse> | null;
  return body && typeof body.code === "string" ? (body as LspErrorResponse) : null;
}

// one line a reviewer can act on: the hint for a missing server, else the server's message
export function lspMessage(error: unknown): string {
  const lsp = lspErrorOf(error);
  if (lsp?.hint) return lsp.hint;
  return error instanceof Error ? error.message : "language server request failed";
}
