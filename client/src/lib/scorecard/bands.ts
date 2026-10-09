import type { ChangeFlag, FlagKind, ScoreBand } from "$types";

export const BAND_LABEL: Record<ScoreBand, string> = { low: "Low", medium: "Medium", high: "High" };

// tailwind classes built from the add / mod / del tokens: low = green, medium = amber, high = red
export const BAND_TEXT: Record<ScoreBand, string> = { low: "text-add-text", medium: "text-mod-badge-text", high: "text-del-text" };
export const BAND_BG: Record<ScoreBand, string> = { low: "bg-add-bg", medium: "bg-mod-badge-bg", high: "bg-del-bg" };
export const BAND_DOT: Record<ScoreBand, string> = { low: "bg-add-text", medium: "bg-mod-badge-text", high: "bg-del-text" };

const BAND_RANK: Record<ScoreBand, number> = { low: 0, medium: 1, high: 2 };
const HIGH_FLAGS: FlagKind[] = ["public-api-removed", "sensitive-path"];

export const FLAG_LABEL: Record<FlagKind, string> = {
  "sensitive-path": "Sensitive path",
  "public-api-removed": "Public API removed",
  "public-api-added": "Public API added",
  dependency: "Dependency",
  leftover: "Leftover",
  untested: "Untested",
  hotspot: "Hotspot",
  large: "Large",
};

export function flagBand(flag: ChangeFlag): ScoreBand {
  return HIGH_FLAGS.includes(flag.kind) ? "high" : "medium";
}

export function worstBand(bands: ScoreBand[]): ScoreBand {
  return bands.reduce<ScoreBand>((worst, band) => (BAND_RANK[band] > BAND_RANK[worst] ? band : worst), "low");
}

// null when the file has no flags
export function worstFlagBand(flags: ChangeFlag[]): ScoreBand | null {
  return flags.length ? worstBand(flags.map(flagBand)) : null;
}
