import { describe, expect, it } from "vitest";
import { escEndsVisual, type EscapeState } from "./escapeLayer";

const base: EscapeState = { pending: false, visual: true, dialogOpen: false, codeLayerOpen: false, inField: false };

describe("escEndsVisual", () => {
  it("ends visual mode when nothing sits above it", () => {
    expect(escEndsVisual(base)).toBe(true);
  });

  it("leaves visual mode alone while a code-navigation layer is open", () => {
    expect(escEndsVisual({ ...base, codeLayerOpen: true })).toBe(false);
  });

  it("leaves it alone for a dialog, a pending count or a field", () => {
    expect(escEndsVisual({ ...base, dialogOpen: true })).toBe(false);
    expect(escEndsVisual({ ...base, pending: true })).toBe(false);
    expect(escEndsVisual({ ...base, inField: true })).toBe(false);
  });

  it("does nothing outside visual mode", () => {
    expect(escEndsVisual({ ...base, visual: false })).toBe(false);
  });
});
