import { describe, expect, test } from "bun:test";
import { fromLspCharacter, negotiatedEncoding, toLspCharacter } from "../src/core/lsp/positions";

const EMOJI_LINE = "a🌍b"; // js length 4: a, high, low, b
const CJK_LINE = "x日本y"; // js length 4, utf-8 bytes 8

describe("lsp positions", () => {
  test("utf-16 is the identity, clamped to the line", () => {
    expect(toLspCharacter(EMOJI_LINE, 3, "utf-16")).toBe(3);
    expect(toLspCharacter(EMOJI_LINE, 99, "utf-16")).toBe(4);
    expect(fromLspCharacter(EMOJI_LINE, -2, "utf-16")).toBe(0);
  });

  test("utf-32 counts an emoji as one unit", () => {
    expect(toLspCharacter(EMOJI_LINE, 3, "utf-32")).toBe(2); // before b
    expect(toLspCharacter(EMOJI_LINE, 4, "utf-32")).toBe(3);
    expect(fromLspCharacter(EMOJI_LINE, 2, "utf-32")).toBe(3);
    expect(fromLspCharacter(EMOJI_LINE, 3, "utf-32")).toBe(4);
  });

  test("utf-8 counts bytes: emoji 4, cjk 3", () => {
    expect(toLspCharacter(EMOJI_LINE, 3, "utf-8")).toBe(5);
    expect(toLspCharacter(CJK_LINE, 3, "utf-8")).toBe(7); // before y
    expect(fromLspCharacter(CJK_LINE, 7, "utf-8")).toBe(3);
    expect(fromLspCharacter(EMOJI_LINE, 5, "utf-8")).toBe(3);
  });

  test("cjk is one unit in utf-16 and utf-32, so those encodings agree", () => {
    for (const character of [0, 1, 2, 3, 4]) {
      expect(toLspCharacter(CJK_LINE, character, "utf-32")).toBe(character);
      expect(fromLspCharacter(CJK_LINE, character, "utf-32")).toBe(character);
    }
  });

  test("an offset inside a surrogate pair counts the whole pair; a position inside a wide char rounds down", () => {
    expect(toLspCharacter(EMOJI_LINE, 2, "utf-32")).toBe(2);
    expect(toLspCharacter(EMOJI_LINE, 2, "utf-8")).toBe(5);
    expect(fromLspCharacter(EMOJI_LINE, 3, "utf-8")).toBe(1); // 3 bytes into the 4-byte emoji
  });

  test("round trips at every code point boundary", () => {
    const line = "é🌍日b🎉";
    for (const encoding of ["utf-8", "utf-16", "utf-32"] as const) {
      let offset = 0;
      for (const cp of [...line, ""]) {
        expect(fromLspCharacter(line, toLspCharacter(line, offset, encoding), encoding)).toBe(offset);
        offset += cp.length;
      }
    }
  });

  test("negotiation falls back to utf-16", () => {
    expect(negotiatedEncoding("utf-8")).toBe("utf-8");
    expect(negotiatedEncoding("utf-32")).toBe("utf-32");
    expect(negotiatedEncoding(undefined)).toBe("utf-16");
    expect(negotiatedEncoding("ebcdic")).toBe("utf-16");
  });
});
