import { describe, it, expect } from "bun:test";
import { WHATS_NEW, whatsNewFor, shouldAutoShow } from "../src/client/whatsNew.js";

describe("whatsNewFor", () => {
  it("leads with the current 0.15.0 release", () => {
    expect(WHATS_NEW[0]?.version).toBe("0.15.0");
    expect(whatsNewFor("0.15.0")?.items).toHaveLength(3);
  });

  it("returns the entry for a known version", () => {
    const entry = whatsNewFor("0.9.0");
    expect(entry?.version).toBe("0.9.0");
    expect((entry?.items.length ?? 0) > 0).toBe(true);
  });

  it("returns null for an unknown version", () => {
    expect(whatsNewFor("0.0.1")).toBeNull();
  });

  it("ships every entry with the required shape", () => {
    for (const entry of WHATS_NEW) {
      expect(typeof entry.version).toBe("string");
      expect(typeof entry.date).toBe("string");
      expect(Array.isArray(entry.items)).toBe(true);
      for (const item of entry.items) {
        expect(typeof item.title).toBe("string");
        expect(typeof item.body).toBe("string");
      }
    }
  });
});

describe("shouldAutoShow", () => {
  it("shows when the running version has unseen highlights", () => {
    expect(shouldAutoShow("0.9.0", "")).toBe(true);
    expect(shouldAutoShow("0.9.0", "0.8.1")).toBe(true);
  });

  it("does not show once the version has been seen", () => {
    expect(shouldAutoShow("0.9.0", "0.9.0")).toBe(false);
  });

  it("does not show for a version with no highlights", () => {
    expect(shouldAutoShow("0.8.1", "")).toBe(false);
  });

  it("does not show before the version is known", () => {
    expect(shouldAutoShow("", "")).toBe(false);
    expect(shouldAutoShow(undefined, "")).toBe(false);
  });
});
