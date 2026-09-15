// keeps the mobile file drawer rendered while its close transition plays. the open prop
// belongs to app.js, so both phases are driven from prop changes rather than a close call:
// `mounted` keeps the drawer in the dom, `shown` flips data-open one frame after mount.
import { useState, useEffect } from "/preact.js";
import { tokenMs } from "/motion.js";

export function useDrawerPhase(open, closeToken) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), tokenMs(closeToken));
    return () => clearTimeout(timer);
  }, [open, closeToken]);
  useEffect(() => {
    if (!open || !mounted) return;
    void document.body.offsetWidth; // flush the closed styles before flipping so the open transition plays
    setShown(true);
  }, [open, mounted]);
  return { mounted, shown };
}
