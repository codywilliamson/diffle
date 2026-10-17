// one language server process: spawn, initialize handshake, document sync, progress tracking,
// graceful shutdown with a kill fallback. restart policy lives in the pool, not here.

import { pathToFileURL } from "node:url";
import { PRODUCT } from "../product";
import { installClientHandlers } from "./clientHandlers";
import { JsonRpcConnection, LspClosedError, type RequestOptions } from "./jsonRpc";
import { KILL_GRACE_MS, killTreeNow, reapTree, usesProcessGroups } from "./processGroup";
import { ADVERTISED_ENCODINGS, DEFAULT_ENCODING, negotiatedEncoding, type PositionEncoding } from "./positions";

export const INITIALIZE_TIMEOUT_MS = 60_000; // roslyn loads a solution before it answers
export const SHUTDOWN_TIMEOUT_MS = 3_000;
export const STDERR_TAIL_CHARS = 8_192;
const STDERR_DRAIN_MS = 250;

export interface BridgeOptions {
  command: string;
  args: string[];
  root: string; // workspace root sent to the server (rootUri); never used as its cwd
  cwd: string; // neutral working directory: a checkout must not influence how the server resolves commands
  initializationOptions?: unknown;
  env?: Record<string, string | undefined>;
}

// true when the promise settled before the timer; the timer never outlives the call.
async function within(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), ms); });
  try { return await Promise.race([promise.then(() => true, () => true), late]); } finally { clearTimeout(timer); }
}

export class LspBridge {
  encoding: PositionEncoding = DEFAULT_ENCODING;
  stderrTail = "";
  onExit: ((code: number | null) => void) | undefined;
  onProgress: ((activeTokens: number) => void) | undefined;
  private proc: Bun.Subprocess<"pipe", "pipe", "pipe"> | undefined;
  private connection: JsonRpcConnection | undefined;
  private readonly documents = new Map<string, number>(); // uri -> version
  private readonly progress = new Set<string>();
  private stopping = false;
  private exited = false;
  readonly rootUri: string;

  constructor(private readonly options: BridgeOptions) { this.rootUri = pathToFileURL(options.root).href; }

  get activeProgress(): number { return this.progress.size; }
  get isStopping(): boolean { return this.stopping; }
  get pid(): number | undefined { return this.proc?.pid; }

  async start(): Promise<void> {
    const proc = Bun.spawn([this.options.command, ...this.options.args], {
      cwd: this.options.cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe",
      detached: usesProcessGroups, // own process group on posix, so we can signal server + helpers together
      env: { ...process.env, ...this.options.env },
    });
    this.proc = proc;
    const connection = new JsonRpcConnection((frame) => { proc.stdin.write(frame); proc.stdin.flush(); });
    this.connection = connection;
    installClientHandlers(connection, this.rootUri);
    connection.onNotification("$/progress", (params) => this.trackProgress(params));
    void this.pump(proc.stdout, (chunk) => connection.receive(chunk));
    const stderrDone = this.pump(proc.stderr, (chunk) => this.appendStderr(chunk));
    void proc.exited.then(async (code) => {
      // let the last stderr lines land first so a failed status has them
      await Promise.race([stderrDone, new Promise((resolve) => setTimeout(resolve, STDERR_DRAIN_MS))]);
      this.exited = true;
      if (usesProcessGroups) void reapTree(proc.pid); // a crashed server's helpers must not outlive it
      connection.close(new LspClosedError(`language server exited (${code})`));
      this.onExit?.(code);
    });
    const result = await connection.request<{ capabilities?: { positionEncoding?: string } }>(
      "initialize", this.initializeParams(), { timeoutMs: INITIALIZE_TIMEOUT_MS },
    );
    this.encoding = negotiatedEncoding(result?.capabilities?.positionEncoding);
    connection.notify("initialized", {});
  }

  request<T = unknown>(method: string, params?: unknown, options?: RequestOptions): Promise<T> {
    if (!this.connection) return Promise.reject(new LspClosedError("language server not started"));
    return this.connection.request<T>(method, params, options);
  }

  openDocument(uri: string, languageId: string, text: string): number {
    const known = this.documents.get(uri);
    if (known !== undefined) return known;
    this.documents.set(uri, 1);
    this.connection?.notify("textDocument/didOpen", { textDocument: { uri, languageId, version: 1, text } });
    return 1;
  }

  closeDocument(uri: string): void {
    if (!this.documents.delete(uri)) return;
    this.connection?.notify("textDocument/didClose", { textDocument: { uri } });
  }

  documentVersion(uri: string): number | undefined { return this.documents.get(uri); }

  // polite first: shutdown request, exit notification, then wait; kill if it lingers.
  // every wait is capped, so this always returns within about timeoutMs + 3 * KILL_GRACE_MS.
  async shutdown(timeoutMs = SHUTDOWN_TIMEOUT_MS): Promise<void> {
    if (this.exited || !this.proc) return;
    this.stopping = true;
    const proc = this.proc;
    try {
      await this.connection?.request("shutdown", null, { timeoutMs });
      this.connection?.notify("exit");
    } catch { /* fall through to the reaping below */ }
    const leftInTime = await within(proc.exited, timeoutMs);
    // the leader may be gone while helpers it spawned linger, so reap the group either way (posix)
    if (!leftInTime || usesProcessGroups) await within(reapTree(proc.pid), KILL_GRACE_MS * 2);
    await within(proc.exited, KILL_GRACE_MS);
  }

  // synchronous and blunt: used on exit paths that cannot await. kills the whole tree.
  kill(): void {
    this.stopping = true;
    const pid = this.proc?.pid;
    // a dead pid may be reused on windows, where there is no group to fall back on
    if (pid === undefined || (this.exited && !usesProcessGroups)) return;
    killTreeNow(pid);
  }

  private initializeParams(): unknown {
    return {
      processId: process.pid,
      clientInfo: { name: PRODUCT.name },
      rootUri: this.rootUri,
      workspaceFolders: [{ uri: this.rootUri, name: "root" }],
      initializationOptions: this.options.initializationOptions,
      capabilities: {
        general: { positionEncodings: [...ADVERTISED_ENCODINGS] },
        window: { workDoneProgress: true },
        workspace: { configuration: true, workspaceFolders: true },
        textDocument: { synchronization: { didSave: false }, definition: { linkSupport: true }, hover: { contentFormat: ["markdown", "plaintext"] } },
      },
    };
  }

  private trackProgress(params: unknown): void {
    const { token, value } = (params ?? {}) as { token?: string | number; value?: { kind?: string } };
    if (token === undefined) return;
    if (value?.kind === "begin") this.progress.add(String(token));
    else if (value?.kind === "end") this.progress.delete(String(token));
    else return;
    this.onProgress?.(this.progress.size);
  }

  private appendStderr(chunk: Uint8Array): void {
    this.stderrTail = (this.stderrTail + new TextDecoder().decode(chunk)).slice(-STDERR_TAIL_CHARS);
  }

  private async pump(stream: ReadableStream<Uint8Array>, sink: (chunk: Uint8Array) => void): Promise<void> {
    try { for await (const chunk of stream) sink(chunk); } catch { /* stream closed with the process */ }
  }
}
