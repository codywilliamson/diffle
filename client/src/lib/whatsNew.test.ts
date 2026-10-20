import { describe, expect, it } from "vitest";
import { PRODUCT } from "$product";
import { WHATS_NEW } from "./whatsNew";

describe("what's new", () => {
  it("leads with the rename note and tells the lineage joke exactly once", () => {
    expect(WHATS_NEW.highlights[0]).toContain(PRODUCT.lineage);
    const all = WHATS_NEW.highlights.join("\n");
    expect(all.split(PRODUCT.lineage)).toHaveLength(2);
    expect(WHATS_NEW.highlights[0]).toContain(`the command is now ${PRODUCT.name}.`);
  });

  it("is newer than the 0.28.x line so upgraders see it", () => {
    expect(WHATS_NEW.version).not.toMatch(/^0\.28\./);
  });

  it("is 0.30.0 or later so 0.29 users see the new highlights", () => {
    const [major = 0, minor = 0] = WHATS_NEW.version.split(".").map(Number);
    expect(major > 0 || minor >= 30).toBe(true);
    expect(WHATS_NEW.version).not.toMatch(/^0\.29\./);
  });
});
