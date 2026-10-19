import { describe, expect, it } from "vitest";
import { firstSymbol, tokenAt } from "./token";

describe("tokenAt", () => {
  const line = "const greeter = new Greeter(label);";

  it("finds the word under the caret", () => {
    expect(tokenAt(line, 8)).toEqual({ start: 6, end: 13, text: "greeter" });
    expect(tokenAt(line, 6)?.text).toBe("greeter");
  });

  it("treats the caret at the end of a word as that word", () => {
    expect(tokenAt(line, 13)?.text).toBe("greeter");
    expect(tokenAt(line, 27)?.text).toBe("Greeter");
  });

  it("returns null between words and on punctuation", () => {
    expect(tokenAt("a  +  b", 3)).toBeNull();
    expect(tokenAt("", 0)).toBeNull();
  });

  it("counts utf-16 code units, so emoji and cjk before the word do not shift it", () => {
    const text = 'const 名前 = "😀 日本語"; log(名前);';
    const second = text.lastIndexOf("名前");
    expect(second).toBe(text.indexOf("log(") + 4);
    expect(tokenAt(text, second + 1)).toEqual({ start: second, end: second + 2, text: "名前" });
    // the emoji is two code units, so every offset after it is one past its code point index
    expect([...text].indexOf("l")).toBeLessThan(text.indexOf("l"));
    expect(tokenAt(text, text.indexOf("log") + 1)?.text).toBe("log");
  });

  it("does not split a surrogate pair into a word", () => {
    expect(tokenAt("😀", 0)).toBeNull();
    expect(tokenAt("😀", 1)).toBeNull();
  });

  it("ignores numbers", () => {
    expect(tokenAt("double(21)", 8)).toBeNull();
  });
});

describe("firstSymbol", () => {
  it("skips keywords and primitive types", () => {
    expect(firstSymbol("export async function load(path: string)")?.text).toBe("load");
    expect(firstSymbol("  public static int Count")?.text).toBe("Count");
  });

  it("is null for a line of keywords or punctuation", () => {
    expect(firstSymbol("} else {")).toBeNull();
    expect(firstSymbol("")).toBeNull();
  });
});
