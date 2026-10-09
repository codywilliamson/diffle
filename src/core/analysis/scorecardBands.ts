// turns per-file analysis into the six scorecard categories. every threshold is a named constant.

import type { ChangeFlag, FileAnalysis, FlagKind, ReviewScorecard, ScoreBand, ScorecardCategory } from "../../types";

export const SIZE_MEDIUM_AT = 200; // effective lines
export const SIZE_HIGH_AT = 600;
export const UNTESTED_MEDIUM_AT = 1; // untested files
export const UNTESTED_HIGH_AT = 3;
export const HOTSPOT_MEDIUM_AT = 1; // hotspot files
export const HOTSPOT_HIGH_AT = 3;
export const FLAGS_HIGH_AT = 5; // sensitive-path + leftover + large flags combined
export const MAX_REASONS = 8;
const SIZE_TOP_FILES = 3;
const REMOVED_DEPENDENCY = "removed dependency ";
const RUNTIME_DEPENDENCIES = ["TargetFramework", "dotnet sdk"]; // adapters name these in dependency flag reasons

interface Hit {
  path: string;
  flag: ChangeFlag;
}

const hitsOf = (files: FileAnalysis[], ...kinds: FlagKind[]): Hit[] =>
  files.flatMap((f) => f.flags.filter((flag) => kinds.includes(flag.kind)).map((flag) => ({ path: f.path, flag })));

const withMore = (items: string[]): string[] =>
  items.length > MAX_REASONS ? [...items.slice(0, MAX_REASONS), `+${items.length - MAX_REASONS} more`] : items;

const flagReasons = (hits: Hit[]): string[] => withMore(hits.map((h) => `${h.path}: ${h.flag.reason}`));
const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;
const band = (n: number, mediumAt: number, highAt: number): ScoreBand => (n >= highAt ? "high" : n >= mediumAt ? "medium" : "low");

function size(files: FileAnalysis[], totals: ReviewScorecard["totals"]): ScorecardCategory {
  const hidden = totals.noiseLines ? ` (${totals.noiseLines} noise lines hidden)` : "";
  const top = files.filter((f) => f.effectiveLines > 0).sort((a, b) => b.effectiveLines - a.effectiveLines || (a.path < b.path ? -1 : 1));
  return {
    id: "size", label: "Size", band: band(totals.effectiveLines, SIZE_MEDIUM_AT, SIZE_HIGH_AT),
    summary: `${plural(totals.effectiveLines, "effective line")} across ${plural(totals.files, "file")}${hidden}`,
    reasons: top.slice(0, SIZE_TOP_FILES).map((f) => `${f.path}: ${plural(f.effectiveLines, "effective line")}`),
  };
}

function tests(files: FileAnalysis[]): ScorecardCategory {
  const untested = hitsOf(files, "untested");
  return {
    id: "tests", label: "Tests", band: band(untested.length, UNTESTED_MEDIUM_AT, UNTESTED_HIGH_AT),
    summary: untested.length ? `${plural(untested.length, "changed code file")} without a test in the diff` : "every changed code file has a test, or none needs one",
    reasons: flagReasons(untested),
  };
}

function api(files: FileAnalysis[]): ScorecardCategory {
  const removed = hitsOf(files, "public-api-removed");
  const added = hitsOf(files, "public-api-added");
  const level: ScoreBand = removed.length ? "high" : added.length ? "medium" : "low";
  return {
    id: "api", label: "Public API", band: level,
    summary: level === "low" ? "no public API changes" : `${removed.length} removed, ${added.length} added`,
    reasons: flagReasons([...removed, ...added]),
  };
}

const isRiskyDependency = ({ reason }: ChangeFlag): boolean =>
  reason.startsWith(REMOVED_DEPENDENCY) || RUNTIME_DEPENDENCIES.some((name) => reason.includes(`dependency ${name} `));

function dependencies(files: FileAnalysis[]): ScorecardCategory {
  const hits = hitsOf(files, "dependency");
  const level: ScoreBand = hits.some((h) => isRiskyDependency(h.flag)) ? "high" : hits.length ? "medium" : "low";
  return {
    id: "dependencies", label: "Dependencies", band: level,
    summary: hits.length ? plural(hits.length, "dependency change") : "no dependency changes",
    reasons: flagReasons(hits),
  };
}

function hotspots(files: FileAnalysis[]): ScorecardCategory {
  const hits = hitsOf(files, "hotspot");
  return {
    id: "hotspots", label: "Hotspots", band: band(hits.length, HOTSPOT_MEDIUM_AT, HOTSPOT_HIGH_AT),
    summary: hits.length ? plural(hits.length, "frequently changed file") : "no frequently changed files",
    reasons: flagReasons(hits),
  };
}

// high: FLAGS_HIGH_AT or more flags, or a sensitive path alongside a removed public api; medium: any flag
function flagsCategory(files: FileAnalysis[]): ScorecardCategory {
  const sensitive = hitsOf(files, "sensitive-path");
  const leftovers = hitsOf(files, "leftover");
  const large = hitsOf(files, "large");
  const total = sensitive.length + leftovers.length + large.length;
  const apiRemoved = hitsOf(files, "public-api-removed").length > 0;
  const level: ScoreBand = total >= FLAGS_HIGH_AT || (sensitive.length > 0 && apiRemoved) ? "high" : total > 0 ? "medium" : "low";
  const parts = [
    sensitive.length && plural(sensitive.length, "sensitive path"),
    leftovers.length && plural(leftovers.length, "leftover"),
    large.length && plural(large.length, "large file"),
  ].filter(Boolean);
  return {
    id: "flags", label: "Flags", band: level,
    summary: parts.length ? parts.join(", ") : "no sensitive paths, leftovers, or oversized files",
    reasons: flagReasons([...sensitive, ...leftovers, ...large]),
  };
}

export function buildCategories(files: FileAnalysis[], totals: ReviewScorecard["totals"]): ScorecardCategory[] {
  return [size(files, totals), tests(files), api(files), dependencies(files), hotspots(files), flagsCategory(files)];
}
