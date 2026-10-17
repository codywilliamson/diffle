// per-language server routing. a server starts lazily on the first ensure() for its language,
// is keyed by (language, root) so it stays warm, restarts once after a crash, then is marked failed.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LspLanguageStatus, LspState } from "../../types";
import { PRODUCT } from "../product";
import { LspBridge } from "./bridge";
import { LSP_REGISTRY, type LanguageEntry, type LspLanguage } from "./registry";
import { findExecutable } from "./which";

export const MAX_RESTARTS = 1;

export interface PoolOptions {
  root: string; // repository root; becomes the server's workspace root
  enabled?: boolean; // false (--no-lsp) starts nothing, ever
  registry?: Partial<Record<LspLanguage, LanguageEntry>>; // test override
  searchPath?: string; // test override for PATH
  excludeRoots?: readonly string[]; // servers resolving inside these are refused; defaults to [root]
  shutdownTimeoutMs?: number; // per server, before it is killed
}

interface ServerSpec { command: string; args: string[] }
interface Slot {
  language: LspLanguage;
  state: LspState;
  restarts: number;
  started?: boolean; // initialize handshake finished for the current bridge
  server?: string;
  stderr?: string;
  bridge?: LspBridge;
  ready?: Promise<LspBridge>;
}

export class LspPool {
  private readonly slots = new Map<string, Slot>();
  private readonly retired = new WeakSet<LspBridge>();
  private readonly resolved = new Map<LspLanguage, ServerSpec | null>();
  private readonly rejected = new Set<LspLanguage>(); // a candidate existed but sat inside the repository
  private logDir: string | undefined;
  private disposed = false;

  constructor(private readonly options: PoolOptions) {}

  get enabled(): boolean { return this.options.enabled !== false; }
  get root(): string { return this.options.root; }

  // bridges that finished the handshake; workspace queries fan out to these.
  running(): LspBridge[] {
    return [...this.slots.values()].filter((slot) => slot.bridge && (slot.state === "ready" || slot.state === "indexing")).map((slot) => slot.bridge!);
  }

  status(languages: readonly LspLanguage[]): LspLanguageStatus[] {
    return languages.map((language) => {
      const slot = this.slots.get(this.keyFor(language));
      if (slot) return { language, state: slot.state, restarts: slot.restarts, ...(slot.server ? { server: slot.server } : {}), ...(slot.stderr ? { stderr: slot.stderr } : {}) };
      const found = this.resolve(language);
      return found
        ? { language, state: "idle", restarts: 0, server: found.command }
        : { language, state: "missing", restarts: 0, hint: this.hintFor(language) };
    });
  }

  // resolves to the running bridge, or undefined when the server is missing, failed or the pool is off.
  async ensure(language: LspLanguage): Promise<LspBridge | undefined> {
    if (!this.enabled || this.disposed) return undefined;
    const key = this.keyFor(language);
    if (!this.slots.has(key)) {
      const spec = this.resolve(language);
      if (!spec) return undefined;
      this.slots.set(key, { language, state: "starting", restarts: 0, server: spec.command });
      this.launch(this.slots.get(key)!, spec);
    }
    const slot = this.slots.get(key)!;
    for (;;) {
      const attempt = slot.ready;
      if (slot.state === "failed" || !attempt) return undefined;
      try { return await attempt; } catch { if (slot.ready === attempt) return undefined; }
    }
  }

  // graceful: ask every server to shut down, kill laggards.
  async shutdown(): Promise<void> {
    this.markStopped();
    await Promise.all([...this.slots.values()].map((slot) => slot.bridge?.shutdown(this.options.shutdownTimeoutMs)));
    this.cleanup();
  }

  // synchronous and abrupt, for exit handlers that cannot await.
  killAll(): void {
    this.markStopped();
    for (const slot of this.slots.values()) slot.bridge?.kill();
    this.cleanup();
  }

  private markStopped(): void {
    this.disposed = true;
    for (const slot of this.slots.values()) if (slot.state !== "failed") slot.state = "idle";
  }

  private keyFor(language: LspLanguage): string { return `${language}\0${this.options.root}`; }

  private entry(language: LspLanguage): LanguageEntry { return this.options.registry?.[language] ?? LSP_REGISTRY[language]; }

  private resolve(language: LspLanguage): ServerSpec | undefined {
    if (!this.resolved.has(language)) {
      const logDir = this.logDirectory();
      let spec: ServerSpec | null = null;
      for (const candidate of this.entry(language).candidates) {
        const { path: command, rejected } = findExecutable(candidate.command, { searchPath: this.options.searchPath, excludeRoots: this.options.excludeRoots ?? [this.options.root] });
        if (rejected) this.rejected.add(language);
        if (command) { spec = { command, args: candidate.args(logDir) }; break; }
      }
      this.resolved.set(language, spec);
    }
    return this.resolved.get(language) ?? undefined;
  }

  private hintFor(language: LspLanguage): string {
    const install = this.entry(language).installHint;
    return this.rejected.has(language) ? `ignored a server inside the repository; ${install}` : install;
  }

  private logDirectory(): string {
    this.logDir ??= mkdtempSync(join(tmpdir(), `${PRODUCT.name}-lsp-`));
    return this.logDir;
  }

  private launch(slot: Slot, spec: ServerSpec): void {
    slot.state = "starting";
    const bridge = new LspBridge({
      command: spec.command, args: spec.args, root: this.options.root, cwd: this.logDirectory(),
      initializationOptions: this.entry(slot.language).initializationOptions?.(this.logDirectory()),
    });
    slot.bridge = bridge;
    bridge.onProgress = () => this.settle(slot, bridge);
    bridge.onExit = () => this.handleExit(slot, bridge, spec);
    slot.started = false;
    slot.ready = bridge.start().then(() => {
      slot.started = true;
      this.settle(slot, bridge);
      return bridge;
    }, (error: unknown) => {
      slot.stderr = bridge.stderrTail || String(error);
      this.handleExit(slot, bridge, spec); // before kill(), which would read as an intentional stop
      bridge.kill();
      throw error;
    });
    slot.ready.catch(() => {}); // callers observe the failure through ensure()/status()
  }

  private settle(slot: Slot, bridge: LspBridge): void {
    if (slot.bridge !== bridge || !slot.started || slot.state === "failed") return;
    slot.state = bridge.activeProgress > 0 ? "indexing" : "ready";
  }

  private handleExit(slot: Slot, bridge: LspBridge, spec: ServerSpec): void {
    if (this.retired.has(bridge) || slot.bridge !== bridge) return;
    this.retired.add(bridge);
    if (this.disposed || bridge.isStopping) { slot.state = "idle"; return; }
    slot.stderr = bridge.stderrTail || slot.stderr;
    if (slot.restarts < MAX_RESTARTS) {
      slot.restarts++;
      this.launch(slot, spec);
    } else {
      slot.state = "failed";
    }
  }

  private cleanup(): void {
    // best effort: on windows a server that is still dying keeps its cwd (this dir) locked
    if (this.logDir) { try { rmSync(this.logDir, { recursive: true, force: true }); } catch { /* temp dir; the os cleans it */ } }
    this.logDir = undefined;
  }
}
