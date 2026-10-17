// converts a character offset on one line between js string code units (utf-16, what our
// client and the diff use) and the unit a server negotiated. we advertise utf-16 only; utf-8
// and utf-32 are handled in case a server picks one anyway.

export type PositionEncoding = "utf-8" | "utf-16" | "utf-32";

export const DEFAULT_ENCODING: PositionEncoding = "utf-16";
export const ADVERTISED_ENCODINGS: readonly PositionEncoding[] = ["utf-16"];

export function negotiatedEncoding(value: unknown): PositionEncoding {
  return value === "utf-8" || value === "utf-32" ? value : DEFAULT_ENCODING;
}

const encoder = new TextEncoder();

function widthOf(codePoint: string, encoding: PositionEncoding): number {
  if (encoding === "utf-8") return encoder.encode(codePoint).length;
  if (encoding === "utf-32") return 1;
  return codePoint.length;
}

const clampToLine = (value: number, line: string): number => Math.min(Math.max(value, 0), line.length);

// js code unit offset -> server unit offset. offsets past the line end clamp to the line end;
// an offset inside a surrogate pair counts the whole pair.
export function toLspCharacter(lineText: string, character: number, encoding: PositionEncoding): number {
  if (encoding === "utf-16") return clampToLine(character, lineText);
  let units = 0;
  let consumed = 0;
  for (const cp of lineText) {
    if (consumed >= character) break;
    units += widthOf(cp, encoding);
    consumed += cp.length;
  }
  return units;
}

// server unit offset -> js code unit offset, clamped to the line end.
export function fromLspCharacter(lineText: string, lspCharacter: number, encoding: PositionEncoding): number {
  if (encoding === "utf-16") return clampToLine(lspCharacter, lineText);
  let units = 0;
  let consumed = 0;
  for (const cp of lineText) {
    const width = widthOf(cp, encoding);
    if (units + width > lspCharacter) break;
    units += width;
    consumed += cp.length;
  }
  return consumed;
}
