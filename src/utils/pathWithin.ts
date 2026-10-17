// path-containment guards shared by the file and static-asset handlers.

import { realpathSync } from "node:fs";
import { posix, resolve, win32 } from "node:path";

// the path with symlinks resolved when it exists (macOS /var -> /private/var, junctions), else just
// made absolute; case-folded on windows. process.execPath is already realpath'd, a home-derived path isn't.
export function canonicalPath(path: string, platform: NodeJS.Platform = process.platform): string {
  let resolved = resolve(path);
  try { resolved = realpathSync.native(resolved); } catch { /* not there yet */ }
  return platform === "win32" ? resolved.toLowerCase() : resolved;
}

export const samePath = (a: string, b: string, platform: NodeJS.Platform = process.platform): boolean =>
  canonicalPath(a, platform) === canonicalPath(b, platform);

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
