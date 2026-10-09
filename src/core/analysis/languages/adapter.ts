// the per-language seam for the deterministic scorecard. the core (noise, moved, churn, scoring)
// is language-agnostic; anything that needs to know a language's conventions lives behind this.

import type { ChangeFlag, DiffFile, FileNoise } from "../../../types";

export interface ReviewGroupKey {
  id: string; // stable key, e.g. the .csproj path or "src/core"
  label: string; // shown in the ui, e.g. "Diffle.Core" or "src/core"
}

export interface LanguageAdapter {
  id: string; // "csharp" | "typescript" | "generic" …
  matches(path: string): boolean;
  noise(path: string): FileNoise | null; // language-specific generated files / lockfiles
  isTest(path: string): boolean;
  subjectName(path: string): string; // lowercased stem with test suffixes stripped; a test and its source share it
  groupOf(path: string, cwd: string): ReviewGroupKey;
  // groups each group depends on (e.g. csproj ProjectReference); dependencies are reviewed first
  groupDependencies?(groupIds: string[], cwd: string): Record<string, string[]>;
  flags(file: DiffFile): ChangeFlag[]; // public api, dependency, leftover, sensitive-path flags
}
