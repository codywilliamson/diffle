import type { LanguageAdapter } from "./adapter";
import { csharpAdapter } from "./csharp";
import { resetCsharpProjectCache } from "./csharpProjects";
import { genericAdapter } from "./generic";
import { typescriptAdapter } from "./typescript";
import { resetTypescriptPackageCache } from "./typescriptPaths";

// first match wins; generic matches everything so it stays last
export const ADAPTERS: LanguageAdapter[] = [csharpAdapter, typescriptAdapter, genericAdapter];

export function adapterFor(path: string): LanguageAdapter {
  return ADAPTERS.find((a) => a.matches(path)) ?? genericAdapter;
}

// folder lookups are memoized per analysis, so a project file added mid-session is seen on the next one
export function resetLanguageCaches(): void {
  resetCsharpProjectCache();
  resetTypescriptPackageCache();
}
