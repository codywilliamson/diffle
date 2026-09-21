#!/usr/bin/env bun
// dev launcher: runs the real bun review backend and vite together, proxies /api to that
// exact backend, preserves the generated ?review= id, opens the vite url, and tears both
// processes down cleanly. any extra args (e.g. `bun run dev staged`) pass through to the backend.

import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { openBrowser } from "../src/utils/browser";

const ROOT = join(import.meta.dir, "..");
const REVIEW_URL = /http:\/\/localhost:(\d+)\/\?review=([\w-]+)/;
const VITE_LOCAL = /(https?:\/\/localhost:\d+)\/?/;

const children: ChildProcess[] = [];

function shutdown(code: number): never {
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// resolves with the first regex match printed on a child's stdout (tee'd to our stdout).
function waitForLine(child: ChildProcess, pattern: RegExp, label: string): Promise<RegExpMatchArray> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error(`${label} did not start in time`)), 20_000);
    child.stdout?.on("data", (chunk) => {
      const text = String(chunk);
      process.stdout.write(text);
      buffer += text;
      const match = buffer.match(pattern);
      if (match) {
        clearTimeout(timer);
        resolve(match);
      }
    });
    child.once("exit", (code) => reject(new Error(`${label} exited early (${code})`)));
  });
}

const backend = spawn("bun", [join(ROOT, "src", "index.ts"), "--no-open", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, LOUPE_SESSION_HOST: "cli" },
  stdio: ["ignore", "pipe", "inherit"],
});
children.push(backend);

try {
  const [, backendPort, reviewId] = await waitForLine(backend, REVIEW_URL, "review backend");
  const apiTarget = `http://localhost:${backendPort}`;

  const vite = spawn("bun", ["x", "vite"], {
    cwd: ROOT,
    env: { ...process.env, DIFFLE_API_TARGET: apiTarget },
    stdio: ["ignore", "pipe", "inherit"],
  });
  children.push(vite);

  const [, viteBase] = await waitForLine(vite, VITE_LOCAL, "vite");
  openBrowser(`${viteBase}/?review=${reviewId}`);
} catch (error) {
  console.error(`[diffle dev] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
}
