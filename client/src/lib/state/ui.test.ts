import { describe, it, expect } from "vitest";
import { createUiStore } from "./ui.svelte";

describe("ui store", () => {
  it("keeps only one overlay active", () => {
    const ui = createUiStore();
    ui.openOverlay("help");
    expect(ui.activeOverlay).toBe("help");
    ui.openOverlay("compile");
    expect(ui.activeOverlay).toBe("compile");
    ui.closeOverlay();
    expect(ui.activeOverlay).toBeNull();
  });

  it("toggles an overlay open then closed", () => {
    const ui = createUiStore();
    ui.toggleOverlay("help");
    expect(ui.activeOverlay).toBe("help");
    ui.toggleOverlay("help");
    expect(ui.activeOverlay).toBeNull();
  });

  it("carries a draft summary into feedback preview and clears it on close", () => {
    const ui = createUiStore();
    ui.openFeedbackPreview("Draft reviewer summary");
    expect(ui.activeOverlay).toBe("compile");
    expect(ui.feedbackSummary).toBe("Draft reviewer summary");
    ui.closeOverlay();
    expect(ui.feedbackSummary).toBeNull();
  });

  it("selecting a file records it and closes the drawer", () => {
    const ui = createUiStore();
    ui.openDrawer();
    expect(ui.drawerOpen).toBe(true);
    ui.selectFile("src/a.ts");
    expect(ui.activeFile).toBe("src/a.ts");
    expect(ui.drawerOpen).toBe(false);
  });
});

describe("extending an open comment range", () => {
  it("tells the handler where the range moved from and to, but not for a fresh add", () => {
    const ui = createUiStore();
    const moves: string[] = [];
    ui.setAddExtendedHandler((from, to) => moves.push(`${from.line}-${from.endLine}:${to.line}-${to.endLine}`));
    ui.extendAdd("a.ts", "new", 5); // nothing open: starts one
    expect(moves).toEqual([]);
    ui.extendAdd("a.ts", "new", 8);
    ui.extendAdd("a.ts", "new", 2);
    expect(moves).toEqual(["5-5:5-8", "5-8:2-8"]);
  });
});
