// global keyboard shortcuts. one keydown listener reading the latest app state via a ref.
import { useEffect, useRef } from "/preact.js";

// [key, what it does] — also rendered by the help overlay.
export const SHORTCUTS = [
  ["j", "Next file"],
  ["k", "Previous file"],
  ["v", "Toggle viewed on the current file"],
  ["s", "Unified ↔ side-by-side"],
  ["w", "Wrap lines"],
  ["o", "Single-file ↔ all-files view"],
  ["t", "Toggle light / dark mode"],
  ["r", "Re-run the diff"],
  ["c", "Preview review feedback"],
  ["n", "What's new"],
  ["?", "Show this help"],
  ["Esc", "Close dialogs"],
  ["drag gutter", "Select a line range to comment on"],
  ["Shift-click gutter", "Extend an open comment to another line"],
];
export const shortcutsFor = (radar) => radar ? [...SHORTCUTS, ["[ ]", "Previous / next Radar proof mark"]] : SHORTCUTS;

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

// ctx: { files, activeFile, selectFile, toggleViewed, toggleSplit, toggleWrap, toggleView,
//        cycleTheme, refresh, compile, whatsNew, prevMark, nextMark, toggleHelp, closeOverlays }
export function useShortcuts(ctx) {
  const ref = useRef(ctx);
  ref.current = ctx;

  useEffect(() => {
    const onKey = (e) => {
      const c = ref.current;
      if (e.key === "Escape") return c.closeOverlays();
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

      const current = c.activeFile ?? c.files[0]?.path;
      const idx = c.files.findIndex((f) => f.path === current);
      const step = (delta) => {
        const next = c.files[Math.min(c.files.length - 1, Math.max(0, idx + delta))];
        if (next) c.selectFile(next.path);
      };

      if (e.key === "j") step(1);
      else if (e.key === "k") step(-1);
      else if (e.key === "v" && current) c.toggleViewed(current);
      else if (e.key === "s") c.toggleSplit();
      else if (e.key === "w") c.toggleWrap();
      else if (e.key === "o") c.toggleView();
      else if (e.key === "t") c.cycleTheme();
      else if (e.key === "r") c.refresh();
      else if (e.key === "c") c.compile();
      else if (e.key === "n") c.whatsNew();
      else if (e.key === "[" && c.prevMark) c.prevMark();
      else if (e.key === "]" && c.nextMark) c.nextMark();
      else if (e.key === "?") c.toggleHelp();
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
