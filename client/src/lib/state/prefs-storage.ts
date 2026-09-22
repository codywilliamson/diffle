// safe, namespaced localStorage access. presentation prefs use the product identity;
// a legacy value is migrated to the current key the first time it's read.
// every access is wrapped — localStorage throws in private mode.

import { PRODUCT } from "$product";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PREFS_PREFIX = `${PRODUCT.name}-`;
export const LEGACY_PREFS_PREFIX = `${PRODUCT.legacyName}-`;

// reads the current product key, falling back to the legacy key which it then
// re-persists under the new key. returns null when neither exists or storage throws.
export function readMigrated(storage: StorageLike, name: string): string | null {
  try {
    const current = storage.getItem(PREFS_PREFIX + name);
    if (current !== null) return current;
    const legacy = storage.getItem(LEGACY_PREFS_PREFIX + name);
    if (legacy === null) return null;
    writeKey(storage, name, legacy);
    return legacy;
  } catch {
    return null;
  }
}

export function writeKey(storage: StorageLike, name: string, value: string): void {
  try {
    storage.setItem(PREFS_PREFIX + name, value);
  } catch {
    // best-effort: a rejected write just means this choice won't survive reload
  }
}
