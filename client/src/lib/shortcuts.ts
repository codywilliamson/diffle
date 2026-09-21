// keyboard shortcuts, shared by the app-level handler and the help overlay.
export interface Shortcut {
  key: string;
  label: string;
}

export const SHORTCUTS: Shortcut[] = [
  { key: "t", label: "Toggle light / dark theme" },
  { key: "s", label: "Side-by-side / unified" },
  { key: "w", label: "Wrap long lines" },
  { key: "o", label: "Single-file / all files" },
  { key: "r", label: "Re-run the diff" },
  { key: "n", label: "What's new" },
  { key: "?", label: "Keyboard shortcuts" },
  { key: "Esc", label: "Close the open overlay" },
];

// true for controls that should swallow shortcuts (typing a comment, filtering, etc.).
export function isEditable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable);
}
