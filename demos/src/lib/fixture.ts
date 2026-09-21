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

// a multi-line range comment (lines 10–12 of server.ts: the whole rate-limit check).
export const RANGE_START = 10;
export const RANGE_END = 12;
export const RANGE_TEXT = "gate this whole block behind a config flag so we can disable it in dev";

// a bigger, nested diff so the file-tree take actually shows filtering + scrolling.
const mod = (path: string, base: string, work: string): FixtureFile => ({ path, base, work });
const add = (path: string, work: string): FixtureFile => ({ path, work });

export const BIG_FIXTURE: FixtureFile[] = [
  mod("src/server.ts", "export function serve() {}\n", "import { limit } from './rateLimiter';\nexport function serve() { return limit; }\n"),
  add("src/rateLimiter.ts", "export const limit = 20;\n"),
  mod("src/router.ts", "export const routes = [];\n", "export const routes = ['/health', '/users'];\n"),
  mod("src/routes/health.ts", "export const health = () => 'ok';\n", "export const health = () => ({ ok: true });\n"),
  add("src/routes/users.ts", "export const users = () => [];\n"),
  mod("src/routes/auth.ts", "export const auth = false;\n", "export const auth = true;\n"),
  add("src/routes/session.ts", "export const session = {};\n"),
  mod("src/db/client.ts", "export const db = null;\n", "export const db = connect();\n"),
  add("src/db/migrations/001_init.sql", "create table users (id int);\n"),
  add("src/db/migrations/002_sessions.sql", "create table sessions (id int);\n"),
  add("src/middleware/logger.ts", "export const logger = () => {};\n"),
  mod("src/middleware/cors.ts", "export const cors = '*';\n", "export const cors = 'https://app.example.com';\n"),
  mod("src/utils/env.ts", "export const env = 'dev';\n", "export const env = process.env.NODE_ENV;\n"),
  add("src/utils/time.ts", "export const now = () => Date.now();\n"),
  mod("src/config.ts", "export const port = 3000;\n", "export const port = Number(process.env.PORT) || 3000;\n"),
  mod("tests/router.test.ts", "test('routes', () => {});\n", "test('routes', () => { expect(routes).toHaveLength(2); });\n"),
  add("tests/rateLimiter.test.ts", "test('limit', () => {});\n"),
  add("tests/users.test.ts", "test('users', () => {});\n"),
  mod("package.json", '{\n  "name": "api"\n}\n', '{\n  "name": "api",\n  "version": "0.2.0"\n}\n'),
  mod("README.md", "# api\n", "# api\n\nA tiny HTTP service with rate limiting.\n"),
  add(".github/workflows/ci.yml", "name: ci\non: push\n"),
  mod("tsconfig.json", '{ "strict": false }\n', '{ "strict": true }\n'),
];
