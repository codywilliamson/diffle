// splits a comment body into ordered prose and suggestion segments. pure, shared by the
// server (prompt, get_review) and the client (editor insert, card diff).
// fences follow CommonMark: an opener is 3+ backticks or tildes with at most 3 spaces of
// indentation, and only a fence of the same character, at least as long, closes it. only a
// top-level backtick fence whose info string starts with `suggestion` is a suggestion, so one
// quoted inside a longer example fence stays prose. an unterminated fence leaves the rest of
// the body as prose. suggestion lines are kept as an array so an empty fence (delete) is
// distinguishable from a fence holding one blank line.

export type BodySegment =
  | { kind: "prose"; text: string }
  | { kind: "suggestion"; lines: string[] };

const OPEN_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const SUGGESTION_INFO = /^[ \t]*suggestion(?:[ \t:].*)?$/;
const BACKTICK_RUN = /`+/g;
const MIN_FENCE = 3;

interface Fence { char: string; length: number; suggestion: boolean }

function openerOf(line: string): Fence | null {
  const match = OPEN_FENCE.exec(line);
  if (!match) return null;
  const marker = match[1] as string;
  const info = match[2] as string;
  const char = marker[0] as string;
  if (char === "`" && info.includes("`")) return null; // a backtick info string cannot hold backticks
  return { char, length: marker.length, suggestion: char === "`" && SUGGESTION_INFO.test(info) };
}

function closes(line: string, fence: Fence): boolean {
  const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
  const marker = match?.[1];
  return !!marker && marker[0] === fence.char && marker.length >= fence.length;
}

export function parseSuggestions(body: string): BodySegment[] {
  const lines = body.split(/\r\n|\r|\n/);
  const segments: BodySegment[] = [];
  let prose: string[] = [];
  const flushProse = (): void => {
    const text = prose.join("\n");
    if (text.trim()) segments.push({ kind: "prose", text });
    prose = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const fence = openerOf(line);
    if (!fence) {
      prose.push(line);
      continue;
    }
    const end = lines.findIndex((next, j) => j > i && closes(next, fence));
    if (end === -1) {
      prose.push(...lines.slice(i)); // unterminated: the rest is prose
      break;
    }
    if (fence.suggestion) {
      flushProse();
      segments.push({ kind: "suggestion", lines: lines.slice(i + 1, end) });
    } else {
      prose.push(...lines.slice(i, end + 1)); // an ordinary fence, kept whole
    }
    i = end;
  }
  flushProse();
  return segments;
}

export function hasSuggestionFence(body: string): boolean {
  return parseSuggestions(body).some((segment) => segment.kind === "suggestion");
}

// a fence long enough that the lines inside cannot close it early
export function fenceFor(lines: string[]): string {
  let longest = 0;
  for (const line of lines) for (const run of line.match(BACKTICK_RUN) ?? []) longest = Math.max(longest, run.length);
  return "`".repeat(Math.max(MIN_FENCE, longest + 1));
}

// the text the editor inserts: a suggestion fence prefilled with the anchored lines
export function suggestionFence(lines: string[]): string {
  const fence = fenceFor(lines);
  return [`${fence}suggestion`, ...lines, fence].join("\n");
}
