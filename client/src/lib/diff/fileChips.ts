import type { ChangeFlag, FileAnalysis, FlagKind, ScoreBand } from "$types";

export interface FileChip {
  id: "flags" | "test" | "hot";
  text: string;
  band: ScoreBand | null; // null = neutral
}

export interface FileChips {
  chips: FileChip[]; // every chip, in display order
  details: string[]; // plain-english lines for the popover
}

export const MAX_INLINE_CHIPS = 2;

const FLAG_BAND: Record<FlagKind, ScoreBand> = {
  "sensitive-path": "high",
  "public-api-removed": "high",
  dependency: "medium",
  leftover: "medium",
  untested: "medium",
  large: "medium",
  "public-api-added": "low",
  hotspot: "low",
};
const BAND_RANK: Record<ScoreBand, number> = { low: 0, medium: 1, high: 2 };

export function worstBand(flags: ChangeFlag[]): ScoreBand {
  return flags.reduce<ScoreBand>((worst, f) => (BAND_RANK[FLAG_BAND[f.kind]] > BAND_RANK[worst] ? FLAG_BAND[f.kind] : worst), "low");
}

// the hotspot flag is carried by its own chip, so the flag count excludes it.
export function fileChips(a: FileAnalysis): FileChips {
  const chips: FileChip[] = [];
  const counted = a.flags.filter((f) => f.kind !== "hotspot");
  if (counted.length > 0) {
    chips.push({ id: "flags", text: `${counted.length} ${counted.length === 1 ? "flag" : "flags"}`, band: worstBand(counted) });
  }
  if (a.flags.some((f) => f.kind === "hotspot")) chips.push({ id: "hot", text: `hot · ${a.churn} commits`, band: null });
  if (a.isTest) chips.push({ id: "test", text: "test", band: null });
  return { chips, details: a.flags.map((f) => (f.line != null ? `${f.reason} (line ${f.line})` : f.reason)) };
}
