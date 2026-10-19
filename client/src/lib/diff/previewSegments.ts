// splits a search preview into plain and matched runs, so the panel renders text nodes and
// <mark> elements and never raw html. ranges are [start, end) utf-16 offsets; bad ones are
// clamped, empty ones dropped, overlaps merged.

export interface PreviewSegment {
  text: string;
  match: boolean;
}

export function previewSegments(preview: string, ranges: [number, number][]): PreviewSegment[] {
  const clamp = (n: number): number => Math.max(0, Math.min(n, preview.length));
  const clean = ranges
    .map(([a, b]): [number, number] => [clamp(a), clamp(b)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of clean) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const out: PreviewSegment[] = [];
  let at = 0;
  for (const [a, b] of merged) {
    if (a > at) out.push({ text: preview.slice(at, a), match: false });
    out.push({ text: preview.slice(a, b), match: true });
    at = b;
  }
  if (at < preview.length) out.push({ text: preview.slice(at), match: false });
  return out;
}
