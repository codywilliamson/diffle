// map typed Jev answers into Loupe's display model. arithmetic and lane policy remain in code.

import type { RadarLane, RadarUnit } from "../types";
import type { JevAnswer, JevResult, RadarProviderConfig } from "./provider";

const LANE_RANK: Record<RadarLane, number> = { blocker: 0, verified: 1, boundary: 2, attention: 3, routine: 4, noise: 5 };

const probability = (answer: JevAnswer | undefined, key?: string): number => {
  if (!answer) return 0;
  if (answer.type === "noul") return Math.max(0, Math.min(1, answer.noul ?? 0));
  return Math.max(0, Math.min(1, key ? answer.probabilities?.[key] ?? 0 : answer.confidence ?? 0));
};

function materialImpact(answer: JevAnswer | undefined): number {
  if (!answer?.probabilities) return 0;
  return Math.max(0, Math.min(1, (answer.probabilities["2"] ?? 0) + (answer.probabilities["3"] ?? 0)));
}

function promote(current: RadarLane, candidate: RadarLane): RadarLane {
  return LANE_RANK[candidate] < LANE_RANK[current] ? candidate : current;
}

const pct = (value: number) => Math.round(value * 100);
const readable = (value: string | undefined) => value ? value.replaceAll("_", " ") : "semantic change";

export function applyJev(unit: RadarUnit, result: JevResult, config: RadarProviderConfig, elapsedMs: number): RadarUnit {
  const attention = probability(result.answers.attention);
  const sufficient = probability(result.answers.evidence_sufficient);
  const impact = materialImpact(result.answers.impact);
  const kind = result.answers.kind?.choice;
  const raised = attention >= config.attentionThreshold || sufficient < 0.5;
  const lane = raised ? promote(unit.lane, "attention") : unit.lane;
  const provenance = [...unit.provenance, `jev ${attention.toFixed(2)} attention`, `jev ${sufficient.toFixed(2)} evidence sufficiency`];
  return { ...unit, lane, attention: pct(attention), remote: true, providerStatus: "ready",
    chip: lane === "attention" ? `jev · ${readable(kind)}` : unit.chip,
    summary: lane === "attention" && unit.lane !== "attention"
      ? `Jev raised this unit for focused review; the strongest category is ${readable(kind)}.` : unit.summary,
    provenance, distributions: [
      { name: "Review worthy", pct: pct(attention) },
      { name: "Material impact", pct: pct(impact) },
      { name: "Evidence sufficient", pct: pct(sufficient) },
    ], sufficiency: sufficient >= 0.7 ? "sufficient" : sufficient >= 0.5 ? "partial" : "insufficient",
    cache: { state: "live", ms: elapsedMs } };
}
