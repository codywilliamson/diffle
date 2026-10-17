// LSP base-protocol framing: `Content-Length: <bytes>\r\n\r\n<json>`. the length counts utf-8
// bytes, not characters, so the decoder works on bytes and only decodes a complete body.

const HEADER_END = "\r\n\r\n";
const LENGTH_HEADER = /^content-length:\s*(\d+)\s*$/im;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

export function encodeFrame(message: unknown): Uint8Array {
  const body = encoder.encode(JSON.stringify(message));
  const head = encoder.encode(`Content-Length: ${body.byteLength}${HEADER_END}`);
  const frame = new Uint8Array(head.byteLength + body.byteLength);
  frame.set(head, 0);
  frame.set(body, head.byteLength);
  return frame;
}

function indexOfHeaderEnd(buf: Uint8Array): number {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

// feed it raw chunks in any slicing; it returns every message completed by the chunk.
export class FrameDecoder {
  private buf: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): unknown[] {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf, 0);
    merged.set(chunk, this.buf.length);
    this.buf = merged;
    const out: unknown[] = [];
    for (;;) {
      const end = indexOfHeaderEnd(this.buf);
      if (end < 0) break;
      const header = decoder.decode(this.buf.subarray(0, end));
      const length = LENGTH_HEADER.exec(header)?.[1];
      const start = end + HEADER_END.length;
      if (length === undefined) { this.buf = this.buf.subarray(start); continue; }
      const stop = start + Number(length);
      if (this.buf.length < stop) break;
      const body = decoder.decode(this.buf.subarray(start, stop));
      this.buf = this.buf.subarray(stop);
      try { out.push(JSON.parse(body)); } catch { /* a corrupt body is dropped; the stream stays aligned */ }
    }
    return out;
  }
}
