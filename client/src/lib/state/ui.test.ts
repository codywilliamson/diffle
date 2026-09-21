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

  it("selecting a file records it and closes the drawer", () => {
    const ui = createUiStore();
    ui.openDrawer();
    expect(ui.drawerOpen).toBe(true);
    ui.selectFile("src/a.ts");
    expect(ui.activeFile).toBe("src/a.ts");
    expect(ui.drawerOpen).toBe(false);
  });
});
