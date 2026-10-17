// safe, namespaced localStorage access. presentation prefs use the product identity;
// a legacy value is moved to the current key the first time it's read (old key deleted).
// every access is wrapped — localStorage throws in private mode.

import { PRODUCT } from "$product";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const PREFS_PREFIX = `${PRODUCT.name}-`;
export const LEGACY_PREFS_PREFIX = `${PRODUCT.legacyName}-`;

// reads the current product key, falling back to the legacy key which it then
// moves to the new key. returns null when neither exists or storage throws.
export function readMigrated(storage: StorageLike, name: string): string | null {
  try {
    const legacyKey = LEGACY_PREFS_PREFIX + name;
    const current = storage.getItem(PREFS_PREFIX + name);
    const legacy = storage.getItem(legacyKey);
    // the new key is authoritative; a leftover legacy key is dropped (retried every read until it sticks)
    if (current !== null) {
      if (legacy !== null) removeQuietly(storage, legacyKey);
      return current;
    }
    if (legacy === null) return null;
    writeKey(storage, name, legacy);
    // only delete the old key once the new one reads back; otherwise keep reading the old one
    if (storage.getItem(PREFS_PREFIX + name) === legacy) removeQuietly(storage, legacyKey);
    return legacy;
  } catch {
    return null;
  }
}

function removeQuietly(storage: StorageLike, key: string): void {
  try {
    storage.removeItem?.(key);
  } catch {
    // best-effort; the next read retries
  }
}

export function writeKey(storage: StorageLike, name: string, value: string): void {
  try {
    storage.setItem(PREFS_PREFIX + name, value);
  } catch {
    // best-effort: a rejected write just means this choice won't survive reload
  }
}
