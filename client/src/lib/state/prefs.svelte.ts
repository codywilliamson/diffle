// persisted presentation choices: theme, sidebar width, split/unified, wrap, file view.
// keys are namespaced + migrated by prefs-storage; this store owns the document.theme
// side effect and the theme-value migration (claude -> light, claude-dark -> dark).

import { readMigrated, writeKey, type StorageLike } from "./prefs-storage";

export type Theme = "light" | "dark";
export type FileView = "all" | "single";

const THEMES: Theme[] = ["light", "dark"];
const LEGACY_THEMES: Record<string, Theme> = { claude: "light", "claude-dark": "dark" };
const DEFAULT_SIDEBAR = 280;

type MatchMedia = (query: string) => { matches: boolean };

export interface PrefsDeps {
  storage?: StorageLike;
  matchMedia?: MatchMedia;
}

function resolveStorage(injected: StorageLike | undefined): StorageLike {
  const storage = injected ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!storage) throw new Error("createPrefsStore: no storage available");
  return storage;
}

function defaultMatchMedia(): MatchMedia | undefined {
  if (typeof window === "undefined" || !window.matchMedia) return undefined;
  return (query: string) => window.matchMedia(query);
}

function osPrefersDark(matchMedia: MatchMedia | undefined): boolean {
  try {
    return matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

// saved theme wins; a legacy value is migrated and re-persisted; else follow the OS.
function resolveTheme(storage: StorageLike, matchMedia: MatchMedia | undefined): Theme {
  const raw = readMigrated(storage, "theme");
  if (raw && THEMES.includes(raw as Theme)) return raw as Theme;
  const legacy = raw ? LEGACY_THEMES[raw] : undefined;
  if (legacy) {
    writeKey(storage, "theme", legacy);
    return legacy;
  }
  return osPrefersDark(matchMedia) ? "dark" : "light";
}

function resolveNumber(storage: StorageLike, name: string, fallback: number): number {
  const raw = readMigrated(storage, name);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function resolveBool(storage: StorageLike, name: string): boolean {
  return readMigrated(storage, name) === "true";
}

export function createPrefsStore(deps: PrefsDeps = {}) {
  const storage = resolveStorage(deps.storage);
  const matchMedia = deps.matchMedia ?? defaultMatchMedia();

  const initialTheme = resolveTheme(storage, matchMedia);
  let theme = $state<Theme>(initialTheme);
  let sidebarWidth = $state(resolveNumber(storage, "sidebar", DEFAULT_SIDEBAR));
  let split = $state(resolveBool(storage, "split"));
  let wrap = $state(resolveBool(storage, "wrap"));
  let fileView = $state<FileView>(readMigrated(storage, "view") === "single" ? "single" : "all");

  function applyTheme(next: Theme): void {
    try {
      document.documentElement.dataset.theme = next;
    } catch {
      // no document (non-browser host) — nothing to reflect the theme onto
    }
  }

  function setTheme(next: Theme): void {
    theme = next;
    writeKey(storage, "theme", next);
    applyTheme(next);
  }

  function setSplit(next: boolean): void {
    split = next;
    writeKey(storage, "split", String(next));
  }

  function setWrap(next: boolean): void {
    wrap = next;
    writeKey(storage, "wrap", String(next));
  }

  applyTheme(initialTheme);

  return {
    get theme(): Theme {
      return theme;
    },
    get sidebarWidth(): number {
      return sidebarWidth;
    },
    get split(): boolean {
      return split;
    },
    get wrap(): boolean {
      return wrap;
    },
    get fileView(): FileView {
      return fileView;
    },
    setTheme,
    toggleTheme(): void {
      setTheme(theme === "dark" ? "light" : "dark");
    },
    setSidebarWidth(px: number): void {
      sidebarWidth = px;
      writeKey(storage, "sidebar", String(px));
    },
    setSplit,
    toggleSplit(): void {
      setSplit(!split);
    },
    setWrap,
    toggleWrap(): void {
      setWrap(!wrap);
    },
    setFileView(next: FileView): void {
      fileView = next;
      writeKey(storage, "view", next);
    },
  };
}

export type PrefsStore = ReturnType<typeof createPrefsStore>;
