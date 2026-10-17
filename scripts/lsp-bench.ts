// go-to-definition latency against a real typescript-language-server and the fixture repo in
// tests/fixtures/lsp-ts. measures the first (cold) answer through the http route, then 50 warm
// ones, prints the numbers and exits 1 when a target is missed (2 when no server is installed).
//
//   bun scripts/lsp-bench.ts

import { rmSync } from "node:fs";
import { LspPool } from "../src/core/lsp/pool";
import { findExecutable } from "../src/core/lsp/which";
import { diffFile, startHarness } from "../tests/helpers/lspHttp";
import { fixtureText, positionOf, prepareLspFixture } from "../tests/helpers/lspFixture";

const COLD_TARGET_MS = 3000;
const WARM_REQUESTS = 50;
const WARM_P95_TARGET_MS = 300;
const EXIT_MISSED = 1;
const EXIT_NO_SERVER = 2;

const server = findExecutable("typescript-language-server").path;
if (!server) {
  console.error("lsp-bench: typescript-language-server is not on PATH (npm install -g typescript-language-server typescript)");
  process.exit(EXIT_NO_SERVER);
}

const main = fixtureText("src/main.ts");
const text = fixtureText("src/text.ts");
// symbols across files, a dependency and a line behind emoji and CJK, so warm requests are not one cached answer
const probes = [
  { path: "src/main.ts", ...positionOf(main, "Greeter(", 0) },
  { path: "src/main.ts", ...positionOf(main, "double(", 0) },
  { path: "src/main.ts", ...positionOf(main, "greet(", 0) },
  { path: "src/main.ts", ...positionOf(main, "label)", 0) },
  { path: "src/text.ts", ...positionOf(text, "label)", 0) },
];

const percentile = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;

const root = prepareLspFixture(server);
const pool = new LspPool({ root, shutdownTimeoutMs: 5000 });
const harness = startHarness(root, pool, [diffFile("src/main.ts", [5]), diffFile("src/greeter.ts", [4])]);

async function define(probe: (typeof probes)[number]): Promise<number> {
  const started = performance.now();
  const res = await harness.post("/api/lsp/definition", { ...probe, side: "new" });
  const body = (await res.json()) as { targets?: unknown[]; error?: string };
  const elapsed = performance.now() - started;
  if (res.status !== 200 || !body.targets?.length) throw new Error(`definition ${probe.path}:${probe.line}:${probe.character} -> ${res.status} ${JSON.stringify(body)}`);
  return elapsed;
}

let failed = false;
try {
  const cold = await define(probes[0]!);
  const warm: number[] = [];
  for (let i = 0; i < WARM_REQUESTS; i++) warm.push(await define(probes[i % probes.length]!));
  warm.sort((a, b) => a - b);
  const p50 = percentile(warm, 0.5);
  const p95 = percentile(warm, 0.95);
  const verdict = (ok: boolean) => (ok ? "ok" : "MISSED");
  console.log(`server        ${server}`);
  console.log(`cold          ${cold.toFixed(0)} ms   (target < ${COLD_TARGET_MS} ms)  ${verdict(cold < COLD_TARGET_MS)}`);
  console.log(`warm x${WARM_REQUESTS}      p50 ${p50.toFixed(1)} ms   p95 ${p95.toFixed(1)} ms   max ${warm[warm.length - 1]!.toFixed(1)} ms   (p95 target < ${WARM_P95_TARGET_MS} ms)  ${verdict(p95 < WARM_P95_TARGET_MS)}`);
  failed = cold >= COLD_TARGET_MS || p95 >= WARM_P95_TARGET_MS;
} catch (error) {
  console.error(`lsp-bench: ${error instanceof Error ? error.message : String(error)}`);
  console.error(pool.status(["typescript"])[0]?.stderr ?? "");
  failed = true;
} finally {
  harness.stop();
  await pool.shutdown();
  rmSync(root, { recursive: true, force: true });
}
process.exit(failed ? EXIT_MISSED : 0);
