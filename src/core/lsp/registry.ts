// the one table: which language server serves which language, and which extensions map to it.
// servers are user-installed binaries found on PATH; nothing here downloads or installs.

import type { LspLanguage } from "../../types";

export type { LspLanguage };

export interface ServerCandidate {
  command: string;
  args: (logDir: string) => string[]; // logDir is a temp dir, so servers never log into the checkout
}

export interface LanguageEntry {
  languageIds: Record<string, string>; // file extension (no dot) -> LSP languageId
  candidates: ServerCandidate[]; // tried in order; the first found on PATH wins
  installHint: string;
  initializationOptions?: (logDir: string) => unknown;
}

export const LSP_REGISTRY: Record<LspLanguage, LanguageEntry> = {
  typescript: {
    languageIds: {
      ts: "typescript", mts: "typescript", cts: "typescript", tsx: "typescriptreact",
      js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascriptreact",
    },
    candidates: [{ command: "typescript-language-server", args: () => ["--stdio"] }],
    installHint: "npm install -g typescript-language-server typescript",
    initializationOptions: (logDir) => ({
      disableAutomaticTypingAcquisition: true,
      tsserver: { logDirectory: logDir, logVerbosity: "off" },
    }),
  },
  csharp: {
    languageIds: { cs: "csharp" },
    candidates: [
      { command: "roslyn-language-server", args: (logDir) => ["--stdio", "--logLevel", "Information", "--extensionLogDirectory", logDir] },
      { command: "csharp-ls", args: () => [] },
    ],
    installHint: "dotnet tool install -g roslyn-language-server --prerelease (or: dotnet tool install -g csharp-ls)",
  },
};

export const LSP_LANGUAGES = Object.keys(LSP_REGISTRY) as LspLanguage[];

export interface LanguageMatch { language: LspLanguage; languageId: string }

export function languageForPath(path: string): LanguageMatch | undefined {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return undefined;
  const ext = path.slice(dot + 1).toLowerCase();
  for (const language of LSP_LANGUAGES) {
    const languageId = LSP_REGISTRY[language].languageIds[ext];
    if (languageId) return { language, languageId };
  }
  return undefined;
}

// languages present in a set of paths, in registry order.
export function languagesInPaths(paths: readonly string[]): LspLanguage[] {
  const found = new Set<LspLanguage>();
  for (const path of paths) {
    const match = languageForPath(path);
    if (match) found.add(match.language);
  }
  return LSP_LANGUAGES.filter((language) => found.has(language));
}
