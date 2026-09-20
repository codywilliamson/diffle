// wires global keyboard shortcuts to the app's callbacks — split out of app.js to stay under the line cap.
import { useShortcuts } from "/shortcuts.js";

export function useAppShortcuts({
  diff, activeFile, onSelectFile, onToggleViewed, onToggleSplit, onToggleWrap, onToggleView,
  onToggleTheme, onRefresh, wn, setShowCompile, setShowHelp, setAdding, radar,
}) {
  // [ and ] step radar proof marks, but only while radar data is present.
  const marks = radar?.active && radar.order.length > 0;
  useShortcuts({
    files: diff?.files ?? [],
    activeFile,
    selectFile: onSelectFile,
    toggleViewed: onToggleViewed,
    toggleSplit: onToggleSplit,
    toggleWrap: onToggleWrap,
    toggleView: onToggleView,
    cycleTheme: onToggleTheme,
    refresh: onRefresh,
    compile: () => setShowCompile(true),
    whatsNew: wn.reopen,
    toggleHelp: () => setShowHelp((v) => !v),
    prevMark: marks ? () => radar.stepSelection(-1) : null,
    nextMark: marks ? () => radar.stepSelection(1) : null,
    // modals and popovers catch escape themselves (popover.js) so their exit can play;
    // only the comment composer is left for the global handler.
    closeOverlays: () => setAdding(null),
  });
}
