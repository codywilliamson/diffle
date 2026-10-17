import { describe, expect, test } from "bun:test";
import { encodeFrame, FrameDecoder } from "../src/core/lsp/framing";

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

describe("lsp framing", () => {
  test("content-length counts bytes, not characters", () => {
    const frame = new TextDecoder().decode(encodeFrame({ t: "é🌍日" }));
    const body = JSON.stringify({ t: "é🌍日" });
    expect(frame.startsWith(`Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n`)).toBe(true);
    expect(new TextEncoder().encode(body).length).toBeGreaterThan(body.length);
  });

  test("decodes a whole frame", () => {
    expect(new FrameDecoder().push(encodeFrame({ id: 1 }))).toEqual([{ id: 1 }]);
  });

  test("survives every possible split point, including inside multi-byte characters", () => {
    const message = { text: "héllo 🌍 日本語" };
    const frame = encodeFrame(message);
    for (let cut = 1; cut < frame.length; cut++) {
      const decoder = new FrameDecoder();
      const first = decoder.push(frame.subarray(0, cut));
      const second = decoder.push(frame.subarray(cut));
      expect([...first, ...second]).toEqual([message]);
    }
  });

  test("survives one byte at a time", () => {
    const decoder = new FrameDecoder();
    const seen: unknown[] = [];
    for (const byte of encodeFrame({ a: "日本" })) seen.push(...decoder.push(new Uint8Array([byte])));
    expect(seen).toEqual([{ a: "日本" }]);
  });

  test("returns several messages from one chunk, in order", () => {
    const chunk = concat(encodeFrame({ n: 1 }), encodeFrame({ n: 2 }), encodeFrame({ n: 3 }));
    expect(new FrameDecoder().push(chunk)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  test("keeps a trailing partial frame for the next chunk", () => {
    const decoder = new FrameDecoder();
    const second = encodeFrame({ n: 2 });
    expect(decoder.push(concat(encodeFrame({ n: 1 }), second.subarray(0, 5)))).toEqual([{ n: 1 }]);
    expect(decoder.push(second.subarray(5))).toEqual([{ n: 2 }]);
  });

  test("ignores extra headers and skips a header block with no content-length", () => {
    const body = new TextEncoder().encode('{"ok":true}');
    const withType = concat(new TextEncoder().encode(`Content-Type: application/vscode-jsonrpc; charset=utf-8\r\nContent-Length: ${body.length}\r\n\r\n`), body);
    const junk = new TextEncoder().encode("X-Noise: 1\r\n\r\n");
    expect(new FrameDecoder().push(concat(junk, withType))).toEqual([{ ok: true }]);
  });

  test("drops a corrupt body but stays aligned for the next frame", () => {
    const bad = new TextEncoder().encode("Content-Length: 5\r\n\r\n{nope");
    expect(new FrameDecoder().push(concat(bad, encodeFrame({ n: 2 })))).toEqual([{ n: 2 }]);
  });
});
