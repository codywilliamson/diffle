// renders the two radar surfaces app.js positions with one call: the in-flow review map and
// the overlay evidence drawer. returns siblings (htm array) so app.js stays a thin integration.
import { html } from "/preact.js";
import { RadarMap } from "/radar/RadarMap.js";
import { EvidenceDrawer } from "/radar/EvidenceDrawer.js";

export function RadarShell({ radar }) {
  return [
    html`<${RadarMap} radar=${radar} />`,
    radar.drawer && html`<${EvidenceDrawer} radar=${radar} />`,
  ];
}
