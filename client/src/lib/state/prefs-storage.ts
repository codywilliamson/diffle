// safe, namespaced localStorage access. presentation prefs live under "diffle-*";
// a legacy "loupe-*" value is migrated to the new key the first time it's read.
// every access is wrapped — localStorage throws in private mode.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const NEW_PREFIX = "diffle-";
const LEGACY_PREFIX = "loupe-";

// reads diffle-<name>, falling back to a legacy loupe-<name> value which it then
// re-persists under the new key. returns null when neither exists or storage throws.
export function readMigrated(storage: StorageLike, name: string): string | null {
  try {
    const current = storage.getItem(NEW_PREFIX + name);
    if (current !== null) return current;
    const legacy = storage.getItem(LEGACY_PREFIX + name);
    if (legacy === null) return null;
    writeKey(storage, name, legacy);
    return legacy;
  } catch {
    return null;
  }
}

export function writeKey(storage: StorageLike, name: string, value: string): void {
  try {
    storage.setItem(NEW_PREFIX + name, value);
  } catch {
    // best-effort: a rejected write just means this choice won't survive reload
  }
}
