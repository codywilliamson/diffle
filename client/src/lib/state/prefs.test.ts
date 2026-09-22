import { describe, it, expect } from "vitest";
import { createPrefsStore } from "./prefs.svelte";
import { LEGACY_PREFS_PREFIX, PREFS_PREFIX, type StorageLike } from "./prefs-storage";

type FakeStorage = StorageLike & { data: Record<string, string> };

function fakeStorage(seed: Record<string, string> = {}): FakeStorage {
  const data: Record<string, string> = { ...seed };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const media = (matches: boolean) => () => ({ matches });

describe("prefs store", () => {
  it("uses defaults when nothing is stored", () => {
    const prefs = createPrefsStore({ storage: fakeStorage(), matchMedia: media(false) });
    expect(prefs.theme).toBe("light");
    expect(prefs.sidebarWidth).toBe(280);
    expect(prefs.split).toBe(false);
    expect(prefs.wrap).toBe(false);
    expect(prefs.fileView).toBe("all");
  });

  it("follows OS dark preference when no theme is saved", () => {
    const prefs = createPrefsStore({ storage: fakeStorage(), matchMedia: media(true) });
    expect(prefs.theme).toBe("dark");
  });

  it("round-trips choices through storage", () => {
    const storage = fakeStorage();
    const a = createPrefsStore({ storage, matchMedia: media(false) });
    a.setTheme("dark");
    a.setSidebarWidth(320);
    a.toggleSplit();
    a.toggleWrap();
    a.setFileView("single");

    const b = createPrefsStore({ storage, matchMedia: media(false) });
    expect(b.theme).toBe("dark");
    expect(b.sidebarWidth).toBe(320);
    expect(b.split).toBe(true);
    expect(b.wrap).toBe(true);
    expect(b.fileView).toBe("single");
  });

  it("toggleTheme flips the value and reflects it on the document", () => {
    const prefs = createPrefsStore({ storage: fakeStorage(), matchMedia: media(false) });
    prefs.toggleTheme();
    expect(prefs.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    prefs.toggleTheme();
    expect(prefs.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("migrates legacy loupe-* keys to diffle-* on first read", () => {
    const storage = fakeStorage({
      [`${LEGACY_PREFS_PREFIX}sidebar`]: "360",
      [`${LEGACY_PREFS_PREFIX}split`]: "true",
      [`${LEGACY_PREFS_PREFIX}wrap`]: "true",
      [`${LEGACY_PREFS_PREFIX}view`]: "single",
    });
    const prefs = createPrefsStore({ storage, matchMedia: media(false) });
    expect(prefs.sidebarWidth).toBe(360);
    expect(prefs.split).toBe(true);
    expect(prefs.wrap).toBe(true);
    expect(prefs.fileView).toBe("single");
    // values are re-persisted under the new namespace
    expect(storage.data[`${PREFS_PREFIX}sidebar`]).toBe("360");
    expect(storage.data[`${PREFS_PREFIX}split`]).toBe("true");
    expect(storage.data[`${PREFS_PREFIX}view`]).toBe("single");
  });

  it("prefers an existing diffle-* value over the legacy loupe-* one", () => {
    const storage = fakeStorage({ [`${PREFS_PREFIX}sidebar`]: "300", [`${LEGACY_PREFS_PREFIX}sidebar`]: "360" });
    const prefs = createPrefsStore({ storage, matchMedia: media(false) });
    expect(prefs.sidebarWidth).toBe(300);
  });

  it("migrates legacy theme values claude -> light and claude-dark -> dark", () => {
    const lightStore = fakeStorage({ [`${LEGACY_PREFS_PREFIX}theme`]: "claude" });
    const light = createPrefsStore({ storage: lightStore, matchMedia: media(true) });
    expect(light.theme).toBe("light");
    expect(lightStore.data[`${PREFS_PREFIX}theme`]).toBe("light");

    const darkStore = fakeStorage({ [`${LEGACY_PREFS_PREFIX}theme`]: "claude-dark" });
    const dark = createPrefsStore({ storage: darkStore, matchMedia: media(false) });
    expect(dark.theme).toBe("dark");
    expect(darkStore.data[`${PREFS_PREFIX}theme`]).toBe("dark");
  });
});
