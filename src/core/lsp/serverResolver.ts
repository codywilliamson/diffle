// finds the executable for each language once and owns the temp log dir the servers run in.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT } from "../product";
import { LSP_REGISTRY, type LanguageEntry, type LspLanguage, type ServerCandidate } from "./registry";
import { splitCommandLine, type LspOverrides } from "./overrides";
import { activeVirtualEnv } from "./virtualEnv";
import { findExecutable } from "./which";

export interface ServerSpec { command: string; args: string[]; env?: Record<string, string> }

export interface ResolverOptions {
  root: string;
  registry?: Partial<Record<LspLanguage, LanguageEntry>>; // test override
  searchPath?: string; // test override for PATH
  excludeRoots?: readonly string[]; // servers resolving inside these are refused; defaults to [root]
  overrides?: LspOverrides; // user-chosen commands; "" disables a language
  environment?: NodeJS.ProcessEnv; // test override for VIRTUAL_ENV lookups
}

export class ServerResolver {
  private readonly resolved = new Map<LspLanguage, ServerSpec | null>();
  private readonly rejected = new Set<LspLanguage>(); // a candidate existed but sat inside the repository
  private logDir: string | undefined;

  constructor(private readonly options: ResolverOptions) {}

  entry(language: LspLanguage): LanguageEntry { return this.options.registry?.[language] ?? LSP_REGISTRY[language]; }

  // what gets tried, in order: the user's override alone, or the registry's candidates.
  candidates(language: LspLanguage): ServerCandidate[] {
    const override = this.options.overrides?.[language];
    if (override === undefined) return this.entry(language).candidates;
    try {
      const [command, ...rest] = splitCommandLine(override);
      return command ? [{ command, args: () => rest }] : [];
    } catch { return []; }
  }

  isDisabled(language: LspLanguage): boolean { return this.options.overrides?.[language] !== undefined && this.candidates(language).length === 0; }

  resolve(language: LspLanguage): ServerSpec | undefined {
    if (!this.resolved.has(language)) {
      const logDir = this.logDirectory();
      const venv = this.entry(language).virtualEnv ? activeVirtualEnv(this.options.environment) : undefined;
      let spec: ServerSpec | null = null;
      for (const candidate of this.candidates(language)) {
        const inVenv = venv ? findExecutable(candidate.command, { searchPath: venv.bin }).path : undefined;
        const { path: command, rejected } = inVenv ? { path: inVenv, rejected: false } : findExecutable(candidate.command, { searchPath: this.options.searchPath, excludeRoots: this.options.excludeRoots ?? [this.options.root] });
        if (rejected) this.rejected.add(language);
        if (command) { spec = { command, args: candidate.args(logDir), ...(venv ? { env: venv.env } : {}) }; break; }
      }
      this.resolved.set(language, spec);
    }
    return this.resolved.get(language) ?? undefined;
  }

  hintFor(language: LspLanguage): string {
    if (this.isDisabled(language)) return `disabled by an override (${PRODUCT.name} lsp unset ${language} to re-enable)`;
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
