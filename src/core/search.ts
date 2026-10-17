// pure text search: compile a query into a regex, then scan one file's text line by line.

import type { SearchCase, SearchHit, SearchSide } from "../types";

export const MAX_SEARCH_RESULTS = 500;
export const MAX_PREVIEW_CHARS = 200;
export const MAX_RANGES_PER_LINE = 50;
export const MAX_SCAN_LINE_CHARS = 5_000; // longer lines are cut before matching (minified bundles)
export const MAX_SEARCH_FILE_BYTES = 2_000_000;
export const FILE_TIME_BUDGET_MS = 250;

export class SearchPatternError extends Error {}

// catastrophic backtracking guard. js regex can't be interrupted mid-match, so the time budget alone
// can't save us from one pathological line. we reject the classic shape up front (a quantified group
// that itself holds a quantifier, like (a+)+ or (.*)*), cap the text each match sees, and check the
// clock between lines so a merely slow pattern stops the file instead of the server.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/;

export interface SearchPattern {
  regex: RegExp;
}

// smart case: insensitive unless the query itself has an uppercase letter (regex escapes like \S don't count)
function isCaseInsensitive(query: string, mode: SearchCase, isRegex: boolean): boolean {
  if (mode !== "smart") return mode === "insensitive";
  const letters = isRegex ? query.replace(/\\./g, "") : query;
  return !/\p{Lu}/u.test(letters);
}

const escapeLiteral = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function compilePattern(query: string, isRegex: boolean, mode: SearchCase): SearchPattern {
  const source = isRegex ? query : escapeLiteral(query);
  if (isRegex && NESTED_QUANTIFIER.test(source)) {
    throw new SearchPatternError("pattern has a repeated group inside a repeated group and could hang the search; simplify it");
  }
  const caseFlag = isCaseInsensitive(query, mode, isRegex) ? "i" : "";
  for (const unicode of ["u", ""]) {
    try {
      return { regex: new RegExp(source, `g${caseFlag}${unicode}`) };
    } catch (error) {
      if (!unicode) throw new SearchPatternError(`invalid regex: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new SearchPatternError("invalid regex");
}

// is `index` the low half of a surrogate pair (cutting there would split an emoji)
const splitsPair = (text: string, index: number) => {
  const code = text.charCodeAt(index);
  return code >= 0xdc00 && code <= 0xdfff;
};

// the line cut to MAX_PREVIEW_CHARS around its first match, with ranges shifted into that window.
function windowed(line: string, ranges: [number, number][]): Pick<SearchHit, "preview" | "ranges"> {
  if (line.length <= MAX_PREVIEW_CHARS) return { preview: line, ranges };
  const [first, firstEnd] = ranges[0]!;
  const slack = Math.max(0, MAX_PREVIEW_CHARS - (firstEnd - first));
  let start = Math.min(Math.max(0, first - Math.floor(slack / 2)), line.length - MAX_PREVIEW_CHARS);
  if (splitsPair(line, start)) start += 1;
  let end = start + MAX_PREVIEW_CHARS;
  if (end < line.length && splitsPair(line, end)) end -= 1;
  const shifted = ranges
    .filter(([s, e]) => s < end && e > start)
    .map(([s, e]): [number, number] => [Math.max(s, start) - start, Math.min(e, end) - start]);
  return { preview: line.slice(start, end), ranges: shifted };
}

function matchRanges(regex: RegExp, line: string): [number, number][] {
  const ranges: [number, number][] = [];
  regex.lastIndex = 0;
  for (let match = regex.exec(line); match && ranges.length < MAX_RANGES_PER_LINE; match = regex.exec(line)) {
    if (match[0].length === 0) regex.lastIndex += 1;
    else ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

export interface TextSearchOptions {
  path: string;
  side: SearchSide;
  limit: number; // max hits to return from this text
  budgetMs?: number;
}

export interface TextSearchResult {
  hits: SearchHit[];
  truncated: boolean; // a cap cut this text short (long line, time budget, or `limit` hit with more waiting)
}

// scans line by line (\n or \r\n; the \r never reaches a preview). line numbers are 1-based.
export function searchText(text: string, pattern: SearchPattern, options: TextSearchOptions): TextSearchResult {
  const deadline = performance.now() + (options.budgetMs ?? FILE_TIME_BUDGET_MS);
  const hits: SearchHit[] = [];
  let truncated = false;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (performance.now() > deadline) return { hits, truncated: true };
    let line = lines[i]!;
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line.length > MAX_SCAN_LINE_CHARS) {
      line = line.slice(0, MAX_SCAN_LINE_CHARS);
      truncated = true;
    }
    const ranges = matchRanges(pattern.regex, line);
    if (!ranges.length) continue;
    if (hits.length >= options.limit) return { hits, truncated: true };
    hits.push({ path: options.path, side: options.side, line: i + 1, ...windowed(line, ranges) });
  }
  return { hits, truncated };
}
