// diff-attached radar proof: compact evidence chips in the hunk header and one expanded proof
// note beneath the selected unit. driven entirely by props (radar.diffApi) so it carries no data
// of its own. it never renders an invented finding — only deterministic evidence and provenance.
import { html } from "/preact.js";
import { laneMeta } from "/radar/model.js";
import { LanePill } from "/radar/laneMark.js";

const STATE_TEXT = { analyzing: "analyzing", failed: "jev offline", stale: "stale", blocked: "not sent", cached: "cached" };

// jev attention percent for a chip; suppressed while analyzing/failed, where the state flag speaks.
function attentionText(unit, state) {
  if (state === "analyzing" || state === "failed" || unit.attention == null) return null;
  return `${unit.attention}% attention`;
}

// inline chips rendered inside the existing hunk-header cell, after the @@ pill.
export function HunkChips({ units, radar }) {
  return html`<span class="radar-chips">
    ${units.map((u) => {
      const m = laneMeta(u.lane);
      const state = radar.stateFor(u);
      const att = attentionText(u, state);
      const selected = radar.selectedId === u.id;
      return html`<button key=${u.id} class="radar-chip lane-${m.tone} ${selected ? "is-selected" : ""}" type="button"
        aria-pressed=${selected} onClick=${() => radar.selectUnit(u.id)} title=${`${m.label} — ${u.chip}`}>
        <span class="lane-glyph" aria-hidden="true">${m.glyph}</span>
        <span class="radar-chip-text">${u.chip}</span>
        ${att && html`<span class="radar-chip-att">${att}</span>`}
        ${STATE_TEXT[state] && state !== "cached" && html`<span class="radar-chip-flag">${STATE_TEXT[state]}</span>`}
      </button>`;
    })}
  </span>`;
}

// the expanded proof note row, shown only for the selected unit on this hunk.
export function ProofNoteRow({ unit, radar, colSpan }) {
  const state = radar.stateFor(unit);
  const open = radar.drawerId === unit.id;
  return html`<tr class="radar-proof-row"><td colspan=${colSpan}>
    <div class="radar-proof lane-${laneMeta(unit.lane).tone}">
      <div class="radar-proof-head">
        <${LanePill} lane=${unit.lane} />
        <strong class="radar-proof-title">${unit.title}</strong>
        ${STATE_TEXT[state] && html`<span class="radar-flag flag-${state}">${STATE_TEXT[state]}</span>`}
        <button class="radar-evidence" type="button" aria-expanded=${open} aria-label=${`Evidence for ${unit.title}`}
          onClick=${(e) => radar.openEvidence(unit.id, e.currentTarget)}>Evidence</button>
      </div>
      <p class="radar-proof-summary">${unit.summary}</p>
      ${unit.blockedReason && html`<p class="radar-blocked">Not transmitted — ${unit.blockedReason}</p>`}
      <ul class="radar-provenance">${unit.provenance.map((p, i) => html`<li key=${i}>${p}</li>`)}</ul>
    </div>
  </td></tr>`;
}
