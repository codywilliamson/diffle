// one file row in the index: the select button (name, badge, delta, comment dot) and the viewed box.
import { html, useRef, useEffect } from "/preact.js";
import { changeBadge } from "/util.js";

const CHECK_PATH = "M1 5.52L3.92 9.17L9.17 1";
let checkLen = 0; // measured once (+1 so the stroke never under-draws); every row shares the path

// getTotalLength needs a rendered path — rows mounted inside a display:none tree (mobile drawer
// closed) keep the css fallback, which is calibrated for CHECK_PATH.
function measureCheck(path) {
  if (checkLen) return checkLen;
  try {
    const len = path.getTotalLength();
    if (len > 0) checkLen = Math.ceil(len) + 1;
  } catch { /* not rendered yet */ }
  return checkLen;
}

// native checkbox kept for a11y (visually hidden, focusable, label still toggles) beside the
// drawn box that motion-shell.css fills and strokes.
function ViewedCheck({ path, viewed, onToggle }) {
  const pathRef = useRef(null);
  useEffect(() => {
    const len = measureCheck(pathRef.current);
    if (len) pathRef.current.style.setProperty("--check-len", len);
  }, []);
  return html`<label class="viewed-target" title="Viewed">
    <input type="checkbox" class="viewed-check" aria-label=${`Mark ${path} viewed`} checked=${viewed} onChange=${onToggle} />
    <span class="check-box" aria-hidden="true"><svg viewBox="0 0 10.1668 10.1668"><path ref=${pathRef} d=${CHECK_PATH} /></svg></span>
  </label>`;
}

export function FileRow({ file, viewed, commentCount, active, browse, onSelect, onToggleViewed }) {
  return html`<div class="tree-file ${active ? "active" : ""}">
    <button type="button" class="tree-file-select" aria-current=${active ? "true" : undefined} onClick=${() => onSelect(file.path)}>
      <span class="tree-file-name" title=${file.path}>${file.name}</span>
      ${!browse && html`<span class="badge badge-${file.changeType}">${changeBadge(file.changeType)}</span>`}
      ${!browse && html`<span class="tree-delta"><span class="add">+${file.additions}</span><span class="del">-${file.deletions}</span></span>`}
      ${commentCount > 0 && html`<span class="comment-dot" title=${`${commentCount} comment(s)`}></span>`}
    </button>
    <${ViewedCheck} path=${file.path} viewed=${viewed} onToggle=${() => onToggleViewed(file.path)} />
  </div>`;
}
