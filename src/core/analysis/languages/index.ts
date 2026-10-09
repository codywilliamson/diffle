import type { LanguageAdapter } from "./adapter";
import { csharpAdapter } from "./csharp";
import { genericAdapter } from "./generic";
import { typescriptAdapter } from "./typescript";

// first match wins; generic matches everything so it stays last
export const ADAPTERS: LanguageAdapter[] = [csharpAdapter, typescriptAdapter, genericAdapter];

export function adapterFor(path: string): LanguageAdapter {
  return ADAPTERS.find((a) => a.matches(path)) ?? genericAdapter;
}
