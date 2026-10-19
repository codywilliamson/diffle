import { beforeEach, describe, expect, it } from "vitest";
import { hitAtCaret, rangeFor, textOffset } from "./domPosition";

// the row markup the diff renders: syntax spans, a word-diff mark and a search mark around text
function row(html: string, side = "new", line = 5): HTMLElement {
  document.body.innerHTML = `<section data-file-path="src/a.ts"><span class="code-inner" data-lsp-side="${side}" data-lsp-line="${line}">${html}</span></section>`;
  return document.querySelector<HTMLElement>(".code-inner")!;
}

function textNodeContaining(root: Node, needle: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n as Text).data.includes(needle)) return n as Text;
  throw new Error(`no text node with ${needle}`);
}

describe("textOffset", () => {
  beforeEach(() => (document.body.innerHTML = ""));

  it("counts text across nested spans as one string", () => {
    const root = row('<span style="color:red">const</span> <span class="wd wd-addition">greeter</span> = <mark class="sm">new</mark> Greeter();');
    const node = textNodeContaining(root, "greeter");
    expect(textOffset(root, node, 3)).toBe("const gre".length);
    expect(textOffset(root, textNodeContaining(root, "new"), 0)).toBe("const greeter = ".length);
  });

  it("counts an emoji as its two utf-16 code units and cjk as one each", () => {
    const text = 'const 名前 = "😀"; use(名前);';
    const root = row(`<span>${text.slice(0, 12)}</span><span>${text.slice(12)}</span>`);
    const node = textNodeContaining(root, "use");
    const offset = node.data.indexOf("名前");
    expect(textOffset(root, node, offset)).toBe(text.lastIndexOf("名前"));
    // the emoji pushes the utf-16 offset one past the code point index
    expect(text.lastIndexOf("名前")).toBe([...text].lastIndexOf("名") + 1);
  });
});

describe("hitAtCaret", () => {
  it("maps a caret inside a marked word to the word and its row position", () => {
    const root = row('<span>call(</span><span class="wd wd-addition">greeter</span><span>)</span>');
    const node = textNodeContaining(root, "greeter");
    const hit = hitAtCaret(root, node, 3);
    expect(hit).toMatchObject({ path: "src/a.ts", side: "new", line: 5, token: { start: 5, end: 12, text: "greeter" } });
  });

  it("is on the right word after emoji and cjk", () => {
    const root = row('<span>const 日本語 = "😀 hi"; </span><span>target</span>');
    const node = textNodeContaining(root, "target");
    const hit = hitAtCaret(root, node, 2);
    const text = root.textContent!;
    expect(hit?.token.start).toBe(text.indexOf("target"));
    expect(text.slice(hit!.token.start, hit!.token.end)).toBe("target");
  });

  it("is null on whitespace and for a row without a position", () => {
    const root = row("<span>a   b</span>");
    expect(hitAtCaret(root, textNodeContaining(root, "a"), 2)).toBeNull();
    root.removeAttribute("data-lsp-line");
    expect(hitAtCaret(root, textNodeContaining(root, "a"), 0)).toBeNull();
  });

  it("reports the removed side", () => {
    const root = row("<span>gone()</span>", "old", 9);
    expect(hitAtCaret(root, textNodeContaining(root, "gone"), 1)).toMatchObject({ side: "old", line: 9 });
  });
});

describe("rangeFor", () => {
  it("spans text nodes", () => {
    const root = row("<span>ab</span><span>cd</span><span>ef</span>");
    expect(rangeFor(root, 1, 5)?.toString()).toBe("bcde");
    expect(rangeFor(root, 0, 6)?.toString()).toBe("abcdef");
    expect(rangeFor(root, 3, 99)).toBeNull();
  });
});
