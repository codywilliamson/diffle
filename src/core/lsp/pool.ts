// per-language server routing. a server starts lazily on the first ensure() for its language,
// is keyed by (language, root) so it stays warm, restarts once after a crash, then is marked failed.
// the root is the repository or one of the workspace's detached worktrees (see workspace.ts).

import type { LspLanguageStatus, LspState } from "../../types";
import { LspBridge } from "./bridge";
import type { LanguageEntry, LspLanguage } from "./registry";
import { ServerResolver, type ServerSpec } from "./serverResolver";
import { LspWorkspace } from "./workspace";

export const MAX_RESTARTS = 1;

export interface PoolOptions {
  root: string; // repository root; the default workspace root of every server
  enabled?: boolean; // false (--no-lsp) starts nothing, ever
  registry?: Partial<Record<LspLanguage, LanguageEntry>>; // test override
  searchPath?: string; // test override for PATH
  excludeRoots?: readonly string[]; // servers resolving inside these are refused; defaults to [root]
  shutdownTimeoutMs?: number; // per server, before it is killed
}

// what request handlers see: the pool, or the pool narrowed to one workspace root.
export interface LspHandle {
  readonly enabled: boolean;
  readonly root: string;
  readonly workspace?: LspWorkspace; // only the pool decides roots; a narrowed view does not
  readonly blocker?: string;
  view?(root: string): LspHandle;
  ensure(language: LspLanguage): Promise<LspBridge | undefined>;
  status(languages: readonly LspLanguage[]): LspLanguageStatus[];
  running(): LspBridge[];
}

interface Slot {
  language: LspLanguage;
  root: string;
  state: LspState;
  restarts: number;
  started?: boolean; // initialize handshake finished for the current bridge
  server?: string;
  stderr?: string;
  bridge?: LspBridge;
  ready?: Promise<LspBridge>;
}

export class LspPool implements LspHandle {
  private readonly slots = new Map<string, Slot>();
  private readonly retired = new WeakSet<LspBridge>();
  private readonly resolver: ServerResolver;
  private repoWorkspace: LspWorkspace | undefined;
  private activeRoot: string; // the root of the latest ensure(): what status() reports
  private disposed = false;

  constructor(private readonly options: PoolOptions) {
    this.resolver = new ServerResolver(options);
    this.activeRoot = options.root;
  }

  get enabled(): boolean { return this.options.enabled !== false; }
  get root(): string { return this.options.root; }
  get workspace(): LspWorkspace { return (this.repoWorkspace ??= new LspWorkspace(this.options.root)); }
  get blocker(): string | undefined { return this.repoWorkspace?.blocker; }

  // the same pool seen from one workspace root: its servers, its status.
  view(root: string): LspHandle {
    return {
      enabled: this.enabled, root,
      ensure: (language) => this.ensure(language, root),
      status: (languages) => this.status(languages, root),
      running: () => this.running(root),
    };
  }

  // bridges that finished the handshake; workspace queries fan out to these.
  running(root?: string): LspBridge[] {
    return [...this.slots.values()]
      .filter((slot) => slot.bridge && (slot.state === "ready" || slot.state === "indexing") && (root === undefined || slot.root === root))
      .map((slot) => slot.bridge!);
  }

  status(languages: readonly LspLanguage[], root: string = this.activeRoot): LspLanguageStatus[] {
    return languages.map((language) => {
      const slot = this.slots.get(this.keyFor(language, root));
      if (slot) return { language, state: slot.state, restarts: slot.restarts, ...(slot.server ? { server: slot.server } : {}), ...(slot.stderr ? { stderr: slot.stderr } : {}) };
      const found = this.resolver.resolve(language);
      return found
        ? { language, state: "idle", restarts: 0, server: found.command }
        : { language, state: "missing", restarts: 0, hint: this.resolver.hintFor(language) };
    });
  }

  // resolves to the running bridge, or undefined when the server is missing, failed or the pool is off.
  async ensure(language: LspLanguage, root: string = this.options.root): Promise<LspBridge | undefined> {
    if (!this.enabled || this.disposed) return undefined;
    this.activeRoot = root;
    const key = this.keyFor(language, root);
    if (!this.slots.has(key)) {
      const spec = this.resolver.resolve(language);
      if (!spec) return undefined;
      this.slots.set(key, { language, root, state: "starting", restarts: 0, server: spec.command });
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

  private keyFor(language: LspLanguage, root: string): string { return `${language}\0${root}`; }

  private launch(slot: Slot, spec: ServerSpec): void {
    slot.state = "starting";
    const bridge = new LspBridge({
      command: spec.command, args: spec.args, root: slot.root, cwd: this.resolver.logDirectory(),
      initializationOptions: this.resolver.entry(slot.language).initializationOptions?.(this.resolver.logDirectory()),
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
    this.repoWorkspace?.dispose(); // after the servers stopped: they hold files inside the worktrees
    this.resolver.cleanup();
  }
}
