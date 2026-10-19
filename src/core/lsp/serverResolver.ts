// finds the executable for each language once and owns the temp log dir the servers run in.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "../product";
import { LSP_REGISTRY, type LanguageEntry, type LspLanguage } from "./registry";
import { findExecutable } from "./which";

export interface ServerSpec { command: string; args: string[] }

export interface ResolverOptions {
  root: string;
  registry?: Partial<Record<LspLanguage, LanguageEntry>>; // test override
  searchPath?: string; // test override for PATH
  excludeRoots?: readonly string[]; // servers resolving inside these are refused; defaults to [root]
}

export class ServerResolver {
  private readonly resolved = new Map<LspLanguage, ServerSpec | null>();
  private readonly rejected = new Set<LspLanguage>(); // a candidate existed but sat inside the repository
  private logDir: string | undefined;

  constructor(private readonly options: ResolverOptions) {}

  entry(language: LspLanguage): LanguageEntry { return this.options.registry?.[language] ?? LSP_REGISTRY[language]; }

  resolve(language: LspLanguage): ServerSpec | undefined {
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

  hintFor(language: LspLanguage): string {
    const install = this.entry(language).installHint;
    return this.rejected.has(language) ? `ignored a server inside the repository; ${install}` : install;
  }

  logDirectory(): string {
    this.logDir ??= mkdtempSync(join(tmpdir(), `${PRODUCT.name}-lsp-`));
    return this.logDir;
  }

  cleanup(): void {
    // best effort: on windows a server that is still dying keeps its cwd (this dir) locked
    if (this.logDir) { try { rmSync(this.logDir, { recursive: true, force: true }); } catch { /* temp dir; the os cleans it */ } }
    this.logDir = undefined;
  }
}
