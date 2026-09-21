// ephemeral view state: which single overlay is open, the selected file, and the mobile
// drawer. no persistence and no server — this is throwaway ui state.

export type OverlayName = "help" | "whatsNew" | "compile";

export function createUiStore() {
  let activeOverlay = $state<OverlayName | null>(null);
  let activeFile = $state<string | null>(null);
  let drawerOpen = $state(false);

  return {
    get activeOverlay(): OverlayName | null {
      return activeOverlay;
    },
    get activeFile(): string | null {
      return activeFile;
    },
    get drawerOpen(): boolean {
      return drawerOpen;
    },
    // only one overlay is ever active, so escape can close "the active overlay".
    openOverlay(name: OverlayName): void {
      activeOverlay = name;
    },
    closeOverlay(): void {
      activeOverlay = null;
    },
    toggleOverlay(name: OverlayName): void {
      activeOverlay = activeOverlay === name ? null : name;
    },
    // selecting a file also closes the drawer, since on narrow screens selecting IS navigating.
    selectFile(path: string): void {
      activeFile = path;
      drawerOpen = false;
    },
    openDrawer(): void {
      drawerOpen = true;
    },
    closeDrawer(): void {
      drawerOpen = false;
    },
  };
}

export type UiStore = ReturnType<typeof createUiStore>;
