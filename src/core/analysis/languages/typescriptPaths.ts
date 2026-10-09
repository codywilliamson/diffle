// ts/js path conventions: ownership, generated output, test naming, and review groups.

import type { FileNoise } from "../../../types";
import type { Snapshot } from "../snapshot";
import type { ReviewGroupKey } from "./adapter";
import { ancestorDirs, baseName, ROOT_GROUP, segmentsOf, stemOf } from "./flagHelpers";

const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|svelte|vue)$/i;
const GENERATED_FILE = /\.(generated|gen)\.[^.]+$/i;
const TEST_FILE = /\.(test|spec|pw)\.[^.]+$/i;
const TEST_MARKER = /\.(test|spec|pw)$/i;
const PACKAGE_JSON = "package.json";
const GROUP_DEPTH = 2;

export const matchesTypescript = (path: string): boolean =>
  CODE_FILE.test(baseName(path)) || baseName(path) === PACKAGE_JSON;

export const typescriptNoise = (path: string): FileNoise | null => (GENERATED_FILE.test(baseName(path)) ? "generated" : null);

export const isTypescriptTest = (path: string): boolean =>
  TEST_FILE.test(baseName(path)) || segmentsOf(path).slice(0, -1).includes("__tests__");

export const typescriptSubject = (path: string): string => stemOf(baseName(path)).replace(TEST_MARKER, "").toLowerCase();

// the repository root's package.json is deliberately not a group: it would swallow every file that
// no nested package owns, so those fall back to top-level folders instead
export function typescriptGroupOf(path: string, _cwd: string, snapshot: Snapshot): ReviewGroupKey {
  const pkg = ancestorDirs(path).find((dir) => dir && snapshot.list(dir).includes(PACKAGE_JSON));
  if (pkg) return { id: pkg, label: pkg };
  const dirs = segmentsOf(path).slice(0, -1).slice(0, GROUP_DEPTH);
  const id = dirs.length ? dirs.join("/") : ROOT_GROUP;
  return { id, label: id };
}
