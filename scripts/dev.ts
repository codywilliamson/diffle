#!/usr/bin/env bun
// dev launcher: runs the real bun review backend and vite together, proxies /api to that
// exact backend, preserves the generated ?review= id, opens the vite url, and tears both
// processes down cleanly. any extra args (e.g. `bun run dev staged`) pass through to the backend.

import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { openBrowser } from "../src/utils/browser";

const ROOT = join(import.meta.dir, "..");
const REVIEW_URL = /http:\/\/localhost:(\d+)\/\?review=([\w-]+)/;
const VITE_LOCAL = /https?:\/\/localhost:\d+\/?/;
const START_TIMEOUT_MS = 45_000;
// vite colorizes its output, wrapping even the port number in ansi escapes; strip them
// before matching so the url regex sees plain text.
const ANSI = /\[[0-9;]*m/g;

const children: ChildProcess[] = [];

function shutdown(code: number): never {
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// tee a child's stdout+stderr to our terminal forever, and resolve once a line matches. vite
// prints its url on one of the two streams depending on the platform, so watch both.
function pipeAndWatch(child: ChildProcess, pattern: RegExp, label: string): Promise<RegExpMatchArray> {
  let buffer = "";
  let settle: ((m: RegExpMatchArray) => void) | null = null;
  let fail: ((e: Error) => void) | null = null;
  const promise = new Promise<RegExpMatchArray>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  const timer = setTimeout(() => fail?.(new Error(`${label} did not start in time`)), START_TIMEOUT_MS);
  const consume = (out: NodeJS.WriteStream) => (chunk: Buffer) => {
    out.write(chunk);
    if (!settle) return;
    buffer += String(chunk).replace(ANSI, "");
    const match = buffer.match(pattern);
    if (match) {
      clearTimeout(timer);
      const resolve = settle;
      settle = null;
      resolve(match);
    }
  };
  child.stdout?.on("data", consume(process.stdout));
  child.stderr?.on("data", consume(process.stderr));
  child.once("exit", (code) => {
    if (settle) {
      clearTimeout(timer);
      fail?.(new Error(`${label} exited early (${code})`));
    }
  });
  return promise;
}

const backend = spawn("bun", [join(ROOT, "src", "index.ts"), "--no-open", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, DIFFLE_SESSION_HOST: "cli" },
  stdio: ["ignore", "pipe", "pipe"],
});
children.push(backend);

try {
  const [, backendPort, reviewId] = await pipeAndWatch(backend, REVIEW_URL, "review backend");
  const apiTarget = `http://localhost:${backendPort}`;

  const vite = spawn("bun", ["x", "vite"], {
    cwd: ROOT,
    env: { ...process.env, DIFFLE_API_TARGET: apiTarget },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(vite);

  const [viteBase] = await pipeAndWatch(vite, VITE_LOCAL, "vite");
  const url = `${viteBase.replace(/\/$/, "")}/?review=${reviewId}`;
  console.log(`\n[diffle dev] opening ${url}\n`);
  openBrowser(url);
} catch (error) {
  console.error(`[diffle dev] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
}
