// spawns `nittle --wait --no-open` against a fixture repo and drives it through the same http api
// the browser client uses. the home dir is isolated by the test preload and inherited by the child.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Comment } from "../../src/types";

const entry = join(import.meta.dir, "..", "..", "src", "index.ts");
const URL_PATTERN = /(http:\/\/127\.0\.0\.1:\d+)\/\?review=([\w-]+)/;
// a cold cli start on a loaded machine can take many seconds; an early exit fails fast instead
const STARTUP_TIMEOUT_MS = 30_000;
export const SPAWN_TEST_TIMEOUT_MS = 45_000;
const TAB_SETTLE_MS = 100;

const git = (args: string[], cwd: string) => Bun.spawnSync(["git", ...args], { cwd });

export function makeFixtureRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "nittle-wait-repo-"));
  git(["init", "-q", "-b", "main"], repo);
  git(["config", "user.name", "t"], repo);
  git(["config", "user.email", "t@e.com"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 1;\n");
  git(["add", "-A"], repo);
  git(["commit", "-q", "-m", "init"], repo);
  writeFileSync(join(repo, "a.ts"), "const a = 2;\n");
  return repo;
}

export const fixtureComment: Comment = {
  id: "c1", file: "a.ts", line: 1, lineContent: "+const a = 2;", text: "why the bump?", createdAt: new Date().toISOString(),
};

export interface WaitRun {
  origin: string;
  reviewId: string;
  stderr: () => string;
  stdout: Promise<string>;
  exited: Promise<number>;
  post: (path: string, body: unknown) => Promise<Response>;
  addComment: () => Promise<void>;
  outcome: (outcome: "feedback" | "approved" | "cancelled") => Promise<Response>;
  // opens the presence stream like a browser tab; resolves once connected. call close() to drop it.
  openTab: () => Promise<{ close: () => void }>;
}

export async function startWait(repo: string, args: string[] = [], env: Record<string, string> = {}): Promise<WaitRun> {
  const proc = Bun.spawn(["bun", entry, "--wait", "--no-open", ...args], {
    cwd: repo, stdout: "pipe", stderr: "pipe", env: { ...process.env, ...env },
  });
  let stderrText = "";
  const stderrDone = (async () => {
    const decoder = new TextDecoder();
    for await (const chunk of proc.stderr) stderrText += decoder.decode(chunk);
  })();
  const stdout = new Response(proc.stdout).text();

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let match = URL_PATTERN.exec(stderrText);
  while (!match && proc.exitCode === null && Date.now() < deadline) {
    await Bun.sleep(25);
    match = URL_PATTERN.exec(stderrText);
  }
  if (!match) { proc.kill(); throw new Error(`no url on stderr:\n${stderrText}`); }
  const origin = match[1]!;
  const reviewId = match[2]!;

  const post = (path: string, body: unknown) =>
    fetch(`${origin}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    origin, reviewId, stdout, post,
    stderr: () => stderrText,
    exited: proc.exited.then(async (code) => { await stderrDone; return code; }),
    addComment: async () => { await post("/api/comments", { comments: [fixtureComment] }); },
    outcome: (outcome) => post("/api/review/outcome", { id: reviewId, outcome }),
    // a raw socket, so closing it is a real disconnect the server sees (fetch abort is not reliable under bun test).
    openTab: () => new Promise((resolve, reject) => {
      Bun.connect({
        hostname: "127.0.0.1", port: Number(new URL(origin).port),
        socket: {
          open(socket) { socket.write(`GET /api/presence HTTP/1.1\r\nHost: 127.0.0.1:${new URL(origin).port}\r\nAccept: text/event-stream\r\n\r\n`); },
          // a real tab lives longer than a few ms; closing the instant the first byte lands races bun's disconnect handling.
          data(socket) { setTimeout(() => resolve({ close: () => socket.terminate() }), TAB_SETTLE_MS); },
          error(_socket, error) { reject(error); },
        },
      }).catch(reject);
    }),
  };
}
