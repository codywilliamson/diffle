// ts/js path conventions: ownership, generated output, test naming, and review groups.

import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { FileNoise } from "../../../types";
import type { ReviewGroupKey } from "./adapter";
import { baseName, isInside, ROOT_GROUP, segmentsOf, stemOf } from "./flagHelpers";

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

// cwd -> directory -> package folder id (null = none)
const packageCache = new Map<string, Map<string, string | null>>();

export const resetTypescriptPackageCache = (): void => packageCache.clear();

function packageDir(dir: string, root: string, cache: Map<string, string | null>): string | null {
  if (dir === root || !isInside(root, dir) || dirname(dir) === dir) return null;
  if (cache.has(dir)) return cache.get(dir) ?? null;
  const found = existsSync(join(dir, PACKAGE_JSON)) ? relative(root, dir).replace(/\\/g, "/") : packageDir(dirname(dir), root, cache);
  cache.set(dir, found);
  return found;
}

export function typescriptGroupOf(path: string, cwd: string): ReviewGroupKey {
  const root = resolve(cwd);
  let cache = packageCache.get(root);
  if (!cache) packageCache.set(root, (cache = new Map()));
  const pkg = packageDir(dirname(resolve(root, path)), root, cache);
  if (pkg) return { id: pkg, label: pkg };
  const dirs = segmentsOf(path).slice(0, -1).slice(0, GROUP_DEPTH);
  const id = dirs.length ? dirs.join("/") : ROOT_GROUP;
  return { id, label: id };
}
