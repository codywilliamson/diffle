// `nittle lsp`: print what each language would run, and set or unset stored overrides.

import { effectiveOverrides, lspRoots } from "../core/lsp/launchPool";
import { LSP_LANGUAGES, type LspLanguage } from "../core/lsp/registry";
import { ServerResolver } from "../core/lsp/serverResolver";
import { PRODUCT } from "../core/product";
import { readUserState, writeUserState } from "../core/userState";
import type { LspAction } from "./cliVocabulary";
import type { LspTarget } from "./cliLsp";

const LANGUAGE_WIDTH = Math.max(...LSP_LANGUAGES.map((language) => language.length));

// one line per language, from the real resolver so it matches what a review would launch.
export function lspStatusLines(resolver: ServerResolver, overrides: Partial<Record<LspLanguage, string>>): string[] {
  return LSP_LANGUAGES.map((language) => {
    const label = language.padEnd(LANGUAGE_WIDTH);
    const raw = overrides[language];
    const note = raw === undefined ? "" : ` (override: ${raw === "" ? "disabled" : raw})`;
    const spec = resolver.resolve(language);
    if (spec) return `${label}  ${spec.command}${note}`;
    if (resolver.isDisabled(language)) return `${label}  disabled by an override`;
    const tried = resolver.candidates(language).map((candidate) => candidate.command).join(", ");
    return `${label}  not on PATH (tried ${tried})${note}  ${resolver.hintFor(language)}`;
  });
}

export function lspOverrideLines(stored: Record<string, string> | undefined): string[] {
  const entries = Object.entries(stored ?? {});
  if (!entries.length) return [];
  return ["", "stored overrides", ...entries.map(([language, command]) => `  ${language} = ${command === "" ? '"" (disabled)' : command}`)];
}

export function runLspCommand(action: LspAction | undefined, target: LspTarget | undefined, cwd = process.cwd()): void {
  if (action && target) {
    const next = { ...readUserState().lspOverrides };
    if (action === "set") next[target.language] = target.command; else delete next[target.language];
    writeUserState({ lspOverrides: Object.keys(next).length ? next : undefined });
    const said = action === "set" ? (target.command === "" ? "disabled" : `set to ${target.command}`) : "override removed";
    console.log(`[${PRODUCT.name}] ${target.language}: ${said}`);
    return;
  }
  const { root, excludeRoots } = lspRoots(cwd);
  const overrides = effectiveOverrides();
  const resolver = new ServerResolver({ root, excludeRoots, overrides });
  try {
    console.log([...lspStatusLines(resolver, overrides), ...lspOverrideLines(readUserState().lspOverrides)].join("\n"));
  } finally { resolver.cleanup(); }
}
