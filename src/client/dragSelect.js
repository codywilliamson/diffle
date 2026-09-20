// gutter drag-select for comment ranges, extracted from diffLines.js to keep it under the line
// cap. press a bubble/line number to comment one line, drag to select a range, shift-click to
// extend an open one. `side` ("old"/"new") scopes the drag to rows commentable on that side.
export function startSelect(e, side, anchor, threads) {
  e.preventDefault();
  if (e.shiftKey) return threads.onExtendAdd(side, anchor);
  let head = anchor;
  const section = e.currentTarget.closest(".file-section");
  const attr = side === "old" ? "oldline" : "newline";
  threads.onSelectMove(side, anchor, anchor);
  // rAF-throttle: coalesce mousemove bursts to at most one state update per frame, skip no-ops.
  let raf = 0;
  let lastXY = null;
  const move = (ev) => {
    lastXY = [ev.clientX, ev.clientY];
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const row = document.elementFromPoint(lastXY[0], lastXY[1])?.closest("tr.diff-row");
      const n = row && section.contains(row) ? row.dataset[attr] : "";
      if (n && Number(n) !== head) {
        head = Number(n);
        threads.onSelectMove(side, anchor, head);
      }
    });
  };
  const stop = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", stop);
    document.body.classList.remove("selecting");
    cancelAnimationFrame(raf); // drop any pending move so a stale frame can't land after commit
    threads.onSelectCommit(side, Math.min(anchor, head), Math.max(anchor, head));
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", stop);
  document.body.classList.add("selecting");
}
