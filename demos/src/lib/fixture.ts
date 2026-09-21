// a deterministic, realistic diff for the demo: adds a token-bucket rate limiter, wires it into
// the server, and documents it. multiple files so the index has content; a modified .ts for
// syntax + word highlighting; a modified .md for the sanitized markdown preview.
import type { FixtureFile } from "./backend";

export const FIXTURE: FixtureFile[] = [
  {
    path: "src/rateLimiter.ts",
    // added file (no base)
    work: `import type { Bucket } from "./types";

const REFILL_PER_SECOND = 5;
const BURST = 20;

// token-bucket limiter: each key gets BURST tokens that refill over time.
export function createLimiter() {
  const buckets = new Map<string, Bucket>();

  return function allow(key: string): boolean {
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: BURST, updated: now };
    const elapsed = (now - b.updated) / 1000;
    b.tokens = Math.min(BURST, b.tokens + elapsed * REFILL_PER_SECOND);
    b.updated = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
  };
}
`,
  },
  {
    path: "src/server.ts",
    base: `import { handle } from "./router";

export function serve(port: number) {
  return Bun.serve({
    port,
    fetch(req) {
      return handle(req);
    },
  });
}
`,
    work: `import { handle } from "./router";
import { createLimiter } from "./rateLimiter";

const allow = createLimiter();

export function serve(port: number) {
  return Bun.serve({
    port,
    fetch(req) {
      const ip = req.headers.get("x-forwarded-for") ?? "local";
      if (!allow(ip)) {
        return new Response("rate limited", { status: 429 });
      }
      return handle(req);
    },
  });
}
`,
  },
  {
    path: "README.md",
    base: `# api

A tiny HTTP service.

## Endpoints

- \`GET /health\`
`,
    work: `# api

A tiny HTTP service.

## Endpoints

- \`GET /health\`

## Rate limiting

Every client IP gets a **token bucket** of 20 requests that refills at
5 req/s. Exhausted callers receive a \`429\`.

See [\`src/rateLimiter.ts\`](src/rateLimiter.ts) for the implementation.
`,
  },
];

// the line in server.ts we drop an inline comment on (1-indexed in the working tree).
export const COMMENT_FILE = "src/server.ts";
export const COMMENT_LINE = 10; // the `x-forwarded-for` line
export const COMMENT_TEXT = "prefer a trusted proxy header — x-forwarded-for is spoofable";
export const REVIEW_SUMMARY = "Solid limiter. One nit on the client-IP source before we ship.";
