// evidence drawer: the on-demand ledger for one unit. it reuses the Modal open/close primitive
// (escape, scrim click, exit timing) and adds focus containment + restoration to the triggering
// Evidence button. presented as a right drawer on desktop, a full-height sheet on mobile (radar.css).
import { html, useState, useEffect, useRef } from "/preact.js";
import { Modal } from "/modal.js";
import { X } from "/icons.js";
import { LanePill } from "/radar/laneMark.js";

const SUFFICIENCY = { sufficient: "sufficient", partial: "partial", insufficient: "insufficient" };

function focusables(panel) {
  return [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
}

// keep Tab inside the drawer — the current overlays move focus in; this adds the wrap.
function trapTab(e, panel) {
  const items = focusables(panel);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!items.includes(document.activeElement)) { (e.shiftKey ? last : first).focus(); e.preventDefault(); }
  else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}

export function EvidenceDrawer({ radar }) {
  const { unit, trigger } = radar.drawer;
  const { meta } = radar;
  const state = radar.stateFor(unit);
  const [showPacket, setShowPacket] = useState(false);
  const [packet, setPacket] = useState(null);
  const [packetError, setPacketError] = useState("");
  const headRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const panel = headRef.current?.closest(".modal");
    if (!panel) return;
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Tab" && trapTab(e, panel);
    panel.addEventListener("keydown", onKey);
    return () => {
      panel.removeEventListener("keydown", onKey);
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector(".radar-chip.is-selected, .radar-unit.is-selected")?.focus();
    };
  }, []);

  const remote = unit.distributions && ["ready", "cached", "stale"].includes(state);
  const togglePacket = async () => {
    if (showPacket) return setShowPacket(false);
    setShowPacket(true);
    if (packet) return;
    try { setPacket(await radar.packetFor(unit.id)); }
    catch (error) { setPacketError(error instanceof Error ? error.message : "Packet unavailable"); }
  };

  return html`<${Modal} onClose=${radar.closeEvidence} labelledBy="evidence-title" class="evidence-drawer">
    ${(close) => [
      html`<header class="modal-head" ref=${headRef}>
        <div class="evidence-title"><${LanePill} lane=${unit.lane} /><h2 id="evidence-title">${unit.title}</h2></div>
        <button class="btn-icon" ref=${closeRef} aria-label="Close evidence" onClick=${close}><${X} /></button>
      </header>`,
      html`<div class="evidence-body">
        <section><h3>Deterministic evidence</h3>
          <p class="evidence-chip-line"><span class="evidence-chip">${unit.chip}</span><span class="evidence-suff">evidence ${SUFFICIENCY[unit.sufficiency]}</span></p>
          <ul class="radar-provenance">${unit.provenance.map((p, i) => html`<li key=${i}>${p}</li>`)}</ul>
          ${unit.blockedReason && html`<p class="radar-blocked">Not transmitted — ${unit.blockedReason}</p>`}
        </section>
        <section><h3>Decision distributions</h3>
          ${remote
            ? unit.distributions.map((d, i) => html`<div class="evidence-dist" key=${i}>
                <label>${d.name}<b>${d.pct}%</b></label>
                <div class="evidence-bar"><span style=${`width:${d.pct}%`}></span></div>
              </div>`)
            : html`<p class="evidence-note">${state === "failed" ? "Provider unavailable — deterministic evidence retained; no distributions." : state === "analyzing" ? "Awaiting remote analysis." : "Not transmitted to jev — deterministic evidence only."}</p>`}
        </section>
        <section><h3>Context & transmission</h3>
          <dl class="evidence-facts">
            <dt>Context</dt><dd>${unit.context.lines} lines · ${unit.context.complete ? "complete" : "partial"}</dd>
            <dt>Truncation</dt><dd>${unit.truncation ? "truncated to fit the cap" : "none"}</dd>
            <dt>Redaction</dt><dd>${unit.redaction ? "secret redacted before send" : "none"}</dd>
            <dt>Provider</dt><dd>${meta.provider} · ${meta.model}</dd>
            <dt>Question set</dt><dd>${meta.questionSet}</dd>
            <dt>Cache</dt><dd>${unit.cache.state}${unit.cache.ms ? ` · ${unit.cache.ms} ms` : ""}</dd>
          </dl>
        </section>
        <section>
          <button class="btn-toggle" type="button" aria-expanded=${showPacket} onClick=${togglePacket}>${showPacket ? "Hide" : "Reveal"} exact packet</button>
          ${showPacket && html`<pre class="evidence-packet" aria-label="Exact outbound packet">${packetError || (packet ? JSON.stringify({ provider: meta.provider, model: meta.model, questionSet: meta.questionSet, ...packet }, null, 2) : "Loading packet…")}</pre>`}
        </section>
      </div>`,
      html`<footer class="modal-foot"><button class="btn-plain" onClick=${close}>Close</button></footer>`,
    ]}
  <//>`;
}
