// path-containment guards shared by the file and static-asset handlers.

import { posix, resolve, win32 } from "node:path";

// true when the absolute `target` sits at or below the absolute `base`.
export function containsPath(base: string, target: string): boolean {
  return target === base || target.startsWith(base + "\\") || target.startsWith(base + "/");
}

// true when `rel` resolves inside `root` (defense in depth beyond the ".." check).
export function insideDir(root: string, rel: string): boolean {
  const base = resolve(root);
  return containsPath(base, resolve(base, rel));
}

// absolute on either platform's rules, so a drive-letter path is refused on posix hosts too.
export const isAbsolutePath = (path: string): boolean => posix.isAbsolute(path) || win32.isAbsolute(path);
