// splits a comment body into ordered prose and suggestion segments. pure, shared by the
// server (prompt, get_review) and the client (editor insert, card diff).
// a suggestion is a fenced block whose info string starts with `suggestion`; an unterminated
// fence is plain prose. suggestion lines are kept as an array so an empty fence (delete) is
// distinguishable from a fence holding one blank line.

export type BodySegment =
  | { kind: "prose"; text: string }
  | { kind: "suggestion"; lines: string[] };

const OPEN_FENCE = /^ {0,3}(`{3,})[ \t]*suggestion(?:[ \t:].*)?$/;
const BACKTICK_RUN = /`+/g;
const MIN_FENCE = 3;

function closesFence(line: string, ticks: number): boolean {
  const trimmed = line.trim();
  return trimmed.length >= ticks && /^`+$/.test(trimmed);
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
    const open = OPEN_FENCE.exec(line);
    const ticks = open?.[1]?.length ?? 0;
    const end = open ? lines.findIndex((next, j) => j > i && closesFence(next, ticks)) : -1;
    if (end === -1) {
      prose.push(line);
      continue;
    }
    flushProse();
    segments.push({ kind: "suggestion", lines: lines.slice(i + 1, end) });
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
