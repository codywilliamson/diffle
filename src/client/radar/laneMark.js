// shared lane visuals: a thin shape-coded mark and a text pill. color is never the only cue —
// the mark carries a shape and every pill carries the lane's glyph and full label.
import { html } from "/preact.js";
import { laneMeta } from "/radar/model.js";

// thin vertical mark for the file tree and review map. aria-label names the lane in words.
export function LaneMark({ lane, title }) {
  const m = laneMeta(lane);
  return html`<span class="lane-mark lane-${m.tone} shape-${m.shape}" role="img" aria-label=${`${m.label}${title ? ` — ${title}` : ""}`}></span>`;
}

// lowercase text pill: authored mark shape + lane label. used in proof notes and the drawer.
export function LanePill({ lane, small }) {
  const m = laneMeta(lane);
  return html`<span class="lane-pill lane-${m.tone} ${small ? "lane-pill-sm" : ""}"><${LaneMark} lane=${lane} />${m.label}</span>`;
}
