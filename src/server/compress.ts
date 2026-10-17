// gzips a response at the router choke point when the client accepts it.
// large diffs are ~10x smaller gzipped; tiny/binary bodies pass through untouched.

import { gzipSync } from "bun";

const MIN_COMPRESS_BYTES = 1024;
const COMPRESSIBLE = /^(application\/json|text\/(?!event-stream))/; // event streams must not be buffered

export async function maybeCompress(req: Request, res: Response): Promise<Response> {
  const accepts = req.headers.get("Accept-Encoding") ?? "";
  if (!accepts.includes("gzip")) return res;
  if (!COMPRESSIBLE.test(res.headers.get("Content-Type") ?? "")) return res;

  const body = new Uint8Array(await res.arrayBuffer());
  if (body.byteLength < MIN_COMPRESS_BYTES) {
    return new Response(body, { status: res.status, headers: res.headers });
  }
  const headers = new Headers(res.headers);
  headers.set("Content-Encoding", "gzip");
  headers.set("Vary", "Accept-Encoding");
  return new Response(gzipSync(body), { status: res.status, headers });
}
