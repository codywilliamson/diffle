// review map: a narrow, labelled index of file segments and unit buttons below the top bar.
// it orients the whole diff by lane and source position without ever changing diff order.
// it is a list of buttons, never a canvas chart, and every lane carries text + shape + color.
import { html, useState } from "/preact.js";
import { relativeTime } from "/util.js";
import { LANES, laneMeta, STATUSES } from "/radar/model.js";
import { LaneMark } from "/radar/laneMark.js";

function CountKey({ counts }) {
  return html`<div class="radar-key" aria-label="Units by lane">
    ${LANES.filter((l) => counts[l.key] > 0).map(
      (l) => html`<span key=${l.key} class="radar-count lane-${l.tone}" title=${l.label}>
        <${LaneMark} lane=${l.key} /><b>${counts[l.key]}</b><span class="radar-count-label">${l.label}</span>
      </span>`
    )}
  </div>`;
}

function Segment({ seg, radar }) {
  return html`<div class="radar-seg">
    <button class="radar-seg-file" type="button" title=${seg.path} onClick=${() => radar.selectUnit(seg.units[0].id)}>
      <${LaneMark} lane=${seg.topLane} /><span class="radar-seg-name">${seg.name}</span>
    </button>
    <div class="radar-seg-units">
      ${seg.units.map((u) => {
        const m = laneMeta(u.lane);
        const on = radar.selectedId === u.id;
        return html`<button key=${u.id} class="radar-unit lane-${m.tone} ${on ? "is-selected" : ""}" type="button"
          aria-pressed=${on} aria-label=${`${m.label} — ${u.title}`} title=${`${m.label} — ${u.chip}`}
          onClick=${(event) => {
            radar.selectUnit(u.id);
            if (u.context.lines === 0) radar.openEvidence(u.id, event.currentTarget);
          }}><${LaneMark} lane=${u.lane} /></button>`;
      })}
    </div>
  </div>`;
}

export function RadarMap({ radar }) {
  const [collapsed, setCollapsed] = useState(false);
  if (radar.status === "empty" || !radar.ready) return null;
  const { meta, counts, segments, status } = radar;
  const cached = status === "cached";
  return html`<section class="radar-map" aria-label="Review map">
    <div class="radar-map-bar">
      <button class="radar-map-toggle" type="button" aria-expanded=${!collapsed} onClick=${() => setCollapsed((c) => !c)}>
        Review map<span class="radar-total">${counts.total} unit${counts.total === 1 ? "" : "s"}</span>
      </button>
      <p class="radar-live" role="status" aria-live="polite">${radar.liveMessage}</p>
      <div class="radar-map-meta">
        ${cached && html`<span class="radar-badge">cached</span>`}
        ${status === "stale" && html`<span class="radar-badge badge-warn">stale after refresh</span>`}
        ${status === "partial" && html`<span class="radar-badge badge-warn">partial provider result</span>`}
        <span class="radar-provider" title="provider · model · question set">${meta.provider} · ${meta.model} · ${meta.questionSet}</span>
        <span class="radar-time">analyzed ${relativeTime(meta.generatedAt)}</span>
        ${(status === "failure" || status === "partial") && html`<button class="radar-retry" type="button" onClick=${radar.refresh}>Retry</button>`}
        ${radar.demo && html`<label class="radar-state">demo state
          <select value=${status} onChange=${(e) => radar.setStatus(e.target.value)}>
            ${STATUSES.map((s) => html`<option key=${s.key} value=${s.key}>${s.label}</option>`)}
          </select>
        </label>`}
      </div>
    </div>
    ${status === "analyzing" && html`<div class="radar-progress" role="presentation"><span></span></div>`}
    ${!collapsed && (segments.length
      ? [html`<${CountKey} counts=${counts} />`, html`<div class="radar-map-files">${segments.map((seg) => html`<${Segment} key=${seg.path} seg=${seg} radar=${radar} />`)}</div>`]
      : html`<p class="radar-map-empty">Analysis complete — no attention signals. Review in normal file order.</p>`)}
  </section>`;
}
