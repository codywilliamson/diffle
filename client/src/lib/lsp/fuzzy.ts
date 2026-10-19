// the symbol picker's matcher. a query term must start at a word start of the name and run along
// it: `gre` finds Greeter, `gs` finds GreeterService (the first letters of two words), `ser` finds
// GreeterService, `eet` finds nothing. case never matters. several terms (space separated) must
// all match. pure: no dom, no state.

export interface Match {
  score: number; // lower is better
  indices: number[]; // matched character offsets in the name, for highlighting
}

const SEPARATORS = new Set(["_", "-", ".", "$", " ", "/", ":", "<", ">", "#", "(", ")"]);
const isUpper = (c: string): boolean => c !== c.toLowerCase() && c === c.toUpperCase();
const isLower = (c: string): boolean => c !== c.toUpperCase() && c === c.toLowerCase();
const isDigit = (c: string): boolean => c >= "0" && c <= "9";

// offsets where a word begins: after a separator, at a lower-to-upper step (getUser), at the end
// of an acronym (HTMLParser -> HTML, Parser) and where letters meet digits
export function wordStarts(name: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < name.length; i++) {
    const c = name[i]!;
    if (SEPARATORS.has(c)) continue;
    const previous = name[i - 1];
    const next = name[i + 1];
    const begins =
      previous === undefined ||
      SEPARATORS.has(previous) ||
      (isUpper(c) && isLower(previous)) ||
      (isUpper(c) && isUpper(previous) && next !== undefined && isLower(next)) ||
      (isDigit(c) !== isDigit(previous));
    if (begins) starts.push(i);
  }
  return starts;
}

// matched offsets for `term`, spending it as prefixes of consecutive-or-later words
function matchTerm(lower: string, starts: number[], term: string, fromWord: number): number[] | null {
  for (let w = fromWord; w < starts.length; w++) {
    const start = starts[w]!;
    const end = starts[w + 1] ?? lower.length;
    let run = 0;
    while (run < term.length && start + run < end && lower[start + run] === term[run]) run++;
    for (let k = run; k >= 1; k--) {
      const used = Array.from({ length: k }, (_, i) => start + i);
      if (k === term.length) return used;
      const rest = matchTerm(lower, starts, term.slice(k), w + 1);
      if (rest) return [...used, ...rest];
    }
  }
  return null;
}

export function matchSymbol(query: string, name: string): Match | null {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { score: 0, indices: [] };
  const lower = name.toLowerCase();
  const starts = wordStarts(name);
  const indices = new Set<number>();
  let score = 0;
  for (const term of terms) {
    const found = matchTerm(lower, starts, term, 0);
    if (!found) return null;
    found.forEach((i) => indices.add(i));
    // exact name, then a prefix of the name, then deeper words, then spread over several words
    const spread = found.some((index, n) => n > 0 && index !== found[n - 1]! + 1) ? 1 : 0;
    score += (lower === term ? 0 : found[0] === 0 ? 10 : 20 + found[0]!) + spread * 5;
  }
  return { score: score + name.length / 1000, indices: [...indices].sort((a, b) => a - b) };
}

// items whose name matches, best first; equal scores keep their input order
export function rankByName<T>(items: T[], query: string, nameOf: (item: T) => string): { item: T; match: Match }[] {
  const ranked: { item: T; match: Match; order: number }[] = [];
  items.forEach((item, order) => {
    const match = matchSymbol(query, nameOf(item));
    if (match) ranked.push({ item, match, order });
  });
  return ranked.sort((a, b) => a.match.score - b.match.score || a.order - b.order);
}

// the name cut into runs, flagging the matched ones, for rendering
export function nameSegments(name: string, indices: number[]): { text: string; hit: boolean }[] {
  const hits = new Set(indices);
  const out: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < name.length; i++) {
    const hit = hits.has(i);
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += name[i];
    else out.push({ text: name[i]!, hit });
  }
  return out;
}
