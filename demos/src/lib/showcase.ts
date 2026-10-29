// the launch showcase: a small but realistic ts service whose diff exercises every review aid at
// once. a rate limiter plus its test (review order pairs them), a function moved from router.ts to
// utils/ip.ts (moved-code markers), a tab-to-space reindent (whitespace-only hunk), a lockfile and
// a generated file (noise), an auth change that drops an export and leaves a console.log (scorecard
// flags), and a new dependency. unchanged files (types, routes, tsconfig) keep the language server
// able to resolve every import.
import type { FixtureFile } from "./backend";

const same = (path: string, text: string): FixtureFile => ({ path, base: text, work: text });

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
`;

const TYPES = `export interface Bucket {
  tokens: number;
  updated: number;
}
`;

const HEALTH = `export function health(): Response {
  return Response.json({ ok: true });
}
`;

const USERS = `export function users(_req: Request): Response {
  return Response.json([]);
}
`;

export const RATE_LIMITER = `import type { Bucket } from "./types";

const REFILL_PER_SECOND = 5;
const BURST = 20;

/**
 * Creates a token-bucket limiter. Each key gets BURST tokens that refill
 * at REFILL_PER_SECOND; every allowed request spends one token.
 */
export function createLimiter(now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();

  return function allow(key: string): boolean {
    const t = now();
    const b = buckets.get(key) ?? { tokens: BURST, updated: t };
    b.tokens = Math.min(BURST, b.tokens + ((t - b.updated) / 1000) * REFILL_PER_SECOND);
    b.updated = t;
    buckets.set(key, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}
`;

const LIMITER_TEST = `import { describe, expect, test } from "bun:test";
import { createLimiter } from "../src/rateLimiter";

describe("createLimiter", () => {
  test("allows a burst, then limits until tokens refill", () => {
    let clock = 0;
    const allow = createLimiter(() => clock);
    for (let i = 0; i < 20; i++) expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
    clock += 1000;
    expect(allow("a")).toBe(true);
  });
});
`;

const CLIENT_IP = `export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
`;

const ROUTER_HANDLE = `export function handle(req: Request): Response {
  const { pathname } = new URL(req.url);
  if (pathname === "/health") return health();
  if (pathname === "/users") return users(req);
  return new Response("not found", { status: 404 });
}
`;

const ROUTER_IMPORTS = `import { health } from "./routes/health";
import { users } from "./routes/users";
`;

const SERVER_BASE = `import { handle } from "./router";
import { config } from "./config";

export function serve(port = config.port) {
  return Bun.serve({
    port,
    fetch(req) {
      return handle(req);
    },
  });
}
`;

export const SERVER_WORK = `import { handle } from "./router";
import { config } from "./config";
import { createLimiter } from "./rateLimiter";
import { clientIp } from "./utils/ip";

const allow = createLimiter();

export function serve(port = config.port) {
  return Bun.serve({
    port,
    fetch(req) {
      const ip = clientIp(req);
      if (!allow(ip)) {
        return new Response("rate limited", { status: 429 });
      }
      return handle(req);
    },
  });
}
`;

// the agent's round-two edit: answers the review comment with a Retry-After header.
export const SERVER_ROUND_TWO = SERVER_WORK.replace(
  `        return new Response("rate limited", { status: 429 });`,
  `        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "1" },
        });`,
);

const configWith = (cors: string, metrics: boolean): string => `export const config = {
  port: Number(process.env.PORT) || 3000,
  logLevel: process.env.LOG_LEVEL ?? "info",
${cors}};

export const limits = {
  burst: 20,
  refillPerSecond: 5,
};

export const features = {
  metrics: ${metrics},
  tracing: false,
};
`;
const CORS_TABS = `\tcors: {\n\t\torigin: "*",\n\t\tmethods: ["GET", "POST"],\n\t},\n`;
const CORS_SPACES = `  cors: {\n    origin: "*",\n    methods: ["GET", "POST"],\n  },\n`;

const SESSION_BASE = `const TTL_MS = 60 * 60 * 1000;

export interface Session {
  id: string;
  userId: string;
  expires: number;
}

export function createSession(userId: string): Session {
  return { id: crypto.randomUUID(), userId, expires: Date.now() + TTL_MS };
}

export function isExpired(session: Session): boolean {
  return session.expires < Date.now();
}

export function legacyToken(userId: string): string {
  return btoa(userId);
}
`;

const SESSION_WORK = `const TTL_MS = 60 * 60 * 1000;

export interface Session {
  id: string;
  userId: string;
  expires: number;
}

export function createSession(userId: string): Session {
  console.log("new session", userId);
  // TODO: sliding expiry once the store supports it
  return { id: crypto.randomUUID(), userId, expires: Date.now() + TTL_MS };
}

export function isExpired(session: Session): boolean {
  return session.expires < Date.now();
}
`;

const packageJson = (version: string, deps: Record<string, string>): string =>
  `${JSON.stringify({ name: "api", version, type: "module", dependencies: deps }, null, 2)}\n`;

// a plausible npm v3 lockfile; the diff adds zod and bumps the root version.
function lockfile(version: string, deps: Record<string, string>): string {
  const packages: Record<string, unknown> = { "": { name: "api", version, dependencies: deps } };
  for (const [name, range] of Object.entries(deps)) {
    const exact = range.replace(/^\^/, "");
    packages[`node_modules/${name}`] = {
      version: exact,
      resolved: `https://registry.npmjs.org/${name}/-/${name}-${exact}.tgz`,
      integrity: `sha512-${Buffer.from(`${name}@${exact}`).toString("base64")}`,
      license: "MIT",
      engines: { node: ">=18" },
    };
  }
  return `${JSON.stringify({ name: "api", version, lockfileVersion: 3, requires: true, packages }, null, 2)}\n`;
}

const DEPS_BASE = { hono: "^4.6.0" };
const DEPS_WORK = { hono: "^4.6.0", zod: "^3.23.8" };

const schema = (tables: string[]): string =>
  `// generated by db:codegen. do not edit.\n${tables.map((t) => `export interface ${t}Row {\n  id: string;\n  createdAt: string;\n}\n`).join("\n")}`;

export const SHOWCASE: FixtureFile[] = [
  same("tsconfig.json", TSCONFIG),
  same("src/types.ts", TYPES),
  same("src/routes/health.ts", HEALTH),
  same("src/routes/users.ts", USERS),
  { path: "package.json", base: packageJson("0.1.0", DEPS_BASE), work: packageJson("0.2.0", DEPS_WORK) },
  { path: "package-lock.json", base: lockfile("0.1.0", DEPS_BASE), work: lockfile("0.2.0", DEPS_WORK) },
  { path: "src/rateLimiter.ts", work: RATE_LIMITER },
  { path: "tests/rateLimiter.test.ts", work: LIMITER_TEST },
  { path: "src/server.ts", base: SERVER_BASE, work: SERVER_WORK },
  { path: "src/router.ts", base: `${ROUTER_IMPORTS}\n${CLIENT_IP}\n${ROUTER_HANDLE}`, work: `${ROUTER_IMPORTS}\n${ROUTER_HANDLE}` },
  { path: "src/utils/ip.ts", work: `// the client address behind a proxy: the first forwarded hop, then x-real-ip.\n${CLIENT_IP}` },
  { path: "src/config.ts", base: configWith(CORS_TABS, false), work: configWith(CORS_SPACES, true) },
  { path: "src/auth/session.ts", base: SESSION_BASE, work: SESSION_WORK },
  { path: "src/db/schema.generated.ts", base: schema(["User", "Session"]), work: schema(["User", "Session", "RateLimit"]) },
];

// server.ts is a hotspot: ten recent commits touched it before this change.
export const SHOWCASE_CHURN = { path: "src/server.ts", commits: 10 };

// the commit `nittle show` reviews in the show-commit still.
export const SHOWCASE_COMMIT = {
  message: "feat: rate limit requests per client ip\n\nAdds a token-bucket limiter in front of the router and moves clientIp into\nsrc/utils so the limiter and the router share it.",
  author: "Riley Chen <riley@example.com>",
};

// lines in server.ts (working tree, 1-indexed) the keyboard + code-nav takes land on.
export const SHOWCASE_LIMITER_LINE = 6; // const allow = createLimiter();
export const SHOWCASE_IP_LINE = 12; // const ip = clientIp(req);
export const SHOWCASE_429_LINE = 14; // return new Response("rate limited", ...)
export const SHOWCASE_SEARCH = "clientIp";
