// radar display model: lane metadata + pure ordering/counting helpers. no preact, no dom.
// this is a client-only display model, not a shared contract — it never imports src/types.ts.

// review lanes in priority order. each carries a display label, a css tone class, a short
// glyph, and a mark shape so text and shape carry meaning alongside color.
export const LANES = [
  { key: "blocker", label: "local blocker", tone: "blocker", shape: "barred" },
  { key: "verified", label: "verified finding", tone: "verified", shape: "solid" },
  { key: "boundary", label: "boundary review", tone: "boundary", shape: "solid" },
  { key: "attention", label: "semantic attention", tone: "attention", shape: "solid" },
  { key: "routine", label: "routine review", tone: "routine", shape: "solid" },
  { key: "noise", label: "noise candidate", tone: "noise", shape: "hollow" },
];

const BY_KEY = new Map(LANES.map((l) => [l.key, l]));

export function laneMeta(key) {
  return BY_KEY.get(key) ?? LANES[LANES.length - 1];
}

// lower rank = higher review priority. an unknown lane sorts last.
export function laneRank(key) {
  const i = LANES.findIndex((l) => l.key === key);
  return i === -1 ? LANES.length : i;
}

// jev raises attention but never lowers a deterministic lane, and a stale unit keeps its
// lane rank — it can never visually move into a lower-attention lane after a refresh.
export function effectiveLane(unit) {
  return unit.lane;
}

// units grouped into file segments for the review map: files ordered by their strongest
// (lowest-rank) lane then by diff position; units within a file by lane then source line.
export function buildMap(units, filePaths) {
  const order = new Map(filePaths.map((p, i) => [p, i]));
  const byFile = new Map();
  for (const u of units) {
    const list = byFile.get(u.file);
    list ? list.push(u) : byFile.set(u.file, [u]);
  }
  const segments = [...byFile.entries()].map(([path, list]) => {
    const sorted = [...list].sort((a, b) => laneRank(a.lane) - laneRank(b.lane) || a.line - b.line);
    return { path, name: path.split("/").pop(), fileIndex: order.get(path) ?? Infinity, topLane: sorted[0].lane, units: sorted };
  });
  segments.sort((a, b) => laneRank(a.topLane) - laneRank(b.topLane) || a.fileIndex - b.fileIndex);
  return segments;
}

// the flat proof-mark order for [ and ] navigation — map order, units left to right.
export function markOrder(segments) {
  return segments.flatMap((s) => s.units.map((u) => u.id));
}

// step to the previous/next mark id, clamped at the ends (matches j/k file stepping).
export function stepMark(order, currentId, delta) {
  if (order.length === 0) return null;
  const i = order.indexOf(currentId);
  if (i === -1) return order[delta > 0 ? 0 : order.length - 1];
  return order[Math.min(order.length - 1, Math.max(0, i + delta))];
}

// per-lane counts plus the total, for the map header.
export function laneCounts(units) {
  const counts = Object.fromEntries(LANES.map((l) => [l.key, 0]));
  for (const u of units) counts[u.lane] = (counts[u.lane] ?? 0) + 1;
  return { ...counts, total: units.length };
}

// the highest-priority unit for a file, for the file-tree lane mark + reason.
export function topUnitForFile(units, path) {
  let top = null;
  for (const u of units) {
    if (u.file !== path) continue;
    if (!top || laneRank(u.lane) < laneRank(top.lane) || (laneRank(u.lane) === laneRank(top.lane) && u.line < top.line)) top = u;
  }
  return top;
}

// count of radar units on a file.
export function unitCountForFile(units, path) {
  return units.reduce((n, u) => n + (u.file === path ? 1 : 0), 0);
}

// prototype-only radar statuses, in selector order.
export const STATUSES = [
  { key: "ready", label: "Ready" },
  { key: "analyzing", label: "Analyzing" },
  { key: "cached", label: "Cached" },
  { key: "stale", label: "Stale after refresh" },
  { key: "failure", label: "Provider failure" },
  { key: "blocker", label: "Local blocker" },
  { key: "noattention", label: "No attention" },
  { key: "empty", label: "Empty diff" },
];

// empty diffs carry no marks; "no attention" removes only semantic model promotions and keeps
// every deterministic lane so provider output can never hide local evidence.
export function prioritizedUnits(units, status) {
  if (status === "empty") return [];
  return status === "noattention" ? units.filter((unit) => unit.lane !== "attention") : units;
}

// per-unit presentation state derived from the global status. deterministic lanes always
// remain; only remote (jev) enrichment degrades under analyzing/failure, and a stale unit
// keeps its lane — it is labelled stale, never routed into a lower-attention lane.
export function unitState(unit, status) {
  if (unit.lane === "blocker") return "blocked";
  if (unit.providerStatus === "failed") return "failed";
  if (status === "stale" && unit.stale) return "stale";
  if (unit.remote && status === "analyzing") return "analyzing";
  if (unit.remote && status === "failure") return "failed";
  if (status === "cached") return "cached";
  return "ready";
}
