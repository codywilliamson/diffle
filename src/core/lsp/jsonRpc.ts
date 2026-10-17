// json-rpc 2.0 over lsp framing: id correlation, notifications, server-to-client requests and
// cancellation. transport-agnostic: the owner supplies `send` and calls `receive` per chunk.

import { encodeFrame, FrameDecoder } from "./framing";

export const REQUEST_TIMEOUT_MS = 30_000;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;
const CANCEL_METHOD = "$/cancelRequest";

export class LspCancelledError extends Error { override name = "LspCancelledError"; }
export class LspTimeoutError extends Error { override name = "LspTimeoutError"; }
export class LspClosedError extends Error { override name = "LspClosedError"; }
export class LspResponseError extends Error {
  override name = "LspResponseError";
  constructor(message: string, readonly code: number, readonly data?: unknown) { super(message); }
}

export interface RequestOptions { signal?: AbortSignal; timeoutMs?: number }
type Handler = (params: unknown) => unknown | Promise<unknown>;
interface Pending { resolve: (value: unknown) => void; reject: (error: Error) => void; cleanup: () => void }
interface Message { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { code: number; message: string; data?: unknown } }

export class JsonRpcConnection {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly requestHandlers = new Map<string, Handler>();
  private readonly notificationHandlers = new Map<string, Handler>();
  private readonly decoder = new FrameDecoder();
  private closedWith: Error | undefined;

  constructor(private readonly send: (frame: Uint8Array) => void) {}

  onRequest(method: string, handler: Handler): void { this.requestHandlers.set(method, handler); }
  onNotification(method: string, handler: Handler): void { this.notificationHandlers.set(method, handler); }

  receive(chunk: Uint8Array): void {
    for (const message of this.decoder.push(chunk)) this.dispatch(message as Message);
  }

  request<T = unknown>(method: string, params?: unknown, options: RequestOptions = {}): Promise<T> {
    if (this.closedWith) return Promise.reject(this.closedWith);
    const { signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;
    if (signal?.aborted) return Promise.reject(new LspCancelledError(`${method} cancelled`));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const settle = (error?: Error, value?: unknown) => {
        const entry = this.pending.get(id);
        if (!entry) return;
        entry.cleanup();
        this.pending.delete(id);
        if (error) reject(error); else resolve(value as T);
      };
      const abandon = (error: Error) => { this.notify(CANCEL_METHOD, { id }); settle(error); };
      const onAbort = () => abandon(new LspCancelledError(`${method} cancelled`));
      const timer = setTimeout(() => abandon(new LspTimeoutError(`${method} timed out after ${timeoutMs}ms`)), timeoutMs);
      signal?.addEventListener("abort", onAbort, { once: true });
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); };
      this.pending.set(id, { resolve: (value) => settle(undefined, value), reject: (error) => settle(error), cleanup });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params?: unknown): void {
    if (!this.closedWith) this.write({ jsonrpc: "2.0", method, params });
  }

  // rejects everything in flight; later requests fail fast with the same reason.
  close(reason: Error = new LspClosedError("connection closed")): void {
    if (this.closedWith) return;
    this.closedWith = reason;
    for (const entry of [...this.pending.values()]) entry.reject(reason);
  }

  private write(message: unknown): void {
    try { this.send(encodeFrame(message)); } catch { /* a dead pipe surfaces through process exit */ }
  }

  private dispatch(message: Message): void {
    if (message.method !== undefined && message.id !== undefined) void this.answer(message.id, message.method, message.params);
    else if (message.method !== undefined) {
      // a handler that throws or rejects must not kill the stream or raise an unhandled rejection
      try { void Promise.resolve(this.notificationHandlers.get(message.method)?.(message.params)).catch(() => {}); } catch { /* sync throw */ }
    } else if (typeof message.id === "number") {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      if (message.error) entry.reject(new LspResponseError(message.error.message, message.error.code, message.error.data));
      else entry.resolve(message.result);
    }
  }

  private async answer(id: number | string, method: string, params: unknown): Promise<void> {
    const handler = this.requestHandlers.get(method);
    if (!handler) return this.write({ jsonrpc: "2.0", id, error: { code: METHOD_NOT_FOUND, message: `method not found: ${method}` } });
    try {
      this.write({ jsonrpc: "2.0", id, result: (await handler(params)) ?? null });
    } catch (error) {
      this.write({ jsonrpc: "2.0", id, error: { code: INTERNAL_ERROR, message: error instanceof Error ? error.message : String(error) } });
    }
  }
}
