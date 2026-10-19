// a throwaway copy of tests/fixtures/lsp-ts for tests and the latency bench. the fixture keeps
// its dependency in deps/ (a committed node_modules would be ignored) and this copies it to
// node_modules/, next to a typescript the server can resolve.

import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// dirname works under bun and node, so the playwright navigation spec can share this helper
export const LSP_FIXTURE_DIR = join(import.meta.dirname, "..", "fixtures", "lsp-ts");
const DEPS_DIR = join(LSP_FIXTURE_DIR, "deps");

function typescriptBesideServer(server: string): string | undefined {
  const real = realpathSync(server);
  return [join(dirname(server), "..", "typescript"), join(dirname(server), "node_modules", "typescript"), join(dirname(real), "..", "..", "typescript")]
    .find((candidate) => existsSync(join(candidate, "lib", "tsserver.js")));
}

export function prepareLspFixture(server: string): string {
  const root = mkdtempSync(join(tmpdir(), "nittle-lsp-ts-"));
  cpSync(LSP_FIXTURE_DIR, root, { recursive: true, filter: (source) => source !== DEPS_DIR });
  cpSync(DEPS_DIR, join(root, "node_modules"), { recursive: true });
  const typescript = typescriptBesideServer(server);
  if (typescript) symlinkSync(typescript, join(root, "node_modules", "typescript"), "junction");
  return root;
}

export const fixtureText = (path: string): string => readFileSync(join(LSP_FIXTURE_DIR, path), "utf8");

// 1-based line and utf-16 character of the nth occurrence of `needle` (cursor on its first character)
export function positionOf(text: string, needle: string, nth = 0): { line: number; character: number } {
  let from = -1;
  for (let i = 0; i <= nth; i++) {
    from = text.indexOf(needle, from + 1);
    if (from < 0) throw new Error(`${needle} #${nth} not found`);
  }
  const before = text.slice(0, from).split("\n");
  return { line: before.length, character: before[before.length - 1]!.length };
}
