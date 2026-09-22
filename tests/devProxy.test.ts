import { expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { createServer as createReviewServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";

it("Vite proxies same-origin POSTs and leaves foreign Origin requests blocked", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "diffle-dev-proxy-"));
  const previousTarget = process.env.DIFFLE_API_TARGET;
  const backend = createReviewServer({
    diff: { ref: "working tree", files: [] }, cwd, assets: directoryAssets(cwd),
    loupeRoot: cwd, newRef: null, diffArgs: ["diff", "HEAD"],
    includeUntracked: false, served: false, host: "mcp",
  });
  process.env.DIFFLE_API_TARGET = `http://localhost:${backend.port}`;
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;

  try {
    vite = await createViteServer({
      configFile: resolve(import.meta.dir, "../vite.config.ts"),
      logLevel: "silent",
      server: { host: "localhost", port: 0, strictPort: true, hmr: false },
    });
    await vite.listen();
    const address = vite.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Vite did not listen on a TCP port");
    const base = `http://localhost:${address.port}`;
    const send = (origin: string, comments: unknown[]) => fetch(`${base}/api/comments`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ comments }),
    });

    const comment = { id: "c1", file: "a.ts", line: 1, lineContent: "+a", text: "keep this", createdAt: "2026-09-22T00:00:00.000Z" };
    const valid = await send(base, [comment]);
    expect(valid.status).toBe(200);

    const foreign = await send("https://evil.example", []);
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toEqual({ error: "origin mismatch" });
    const wrongPort = await send(`http://localhost:${address.port + 1}`, []);
    expect(wrongPort.status).toBe(403);
    const review = await fetch(`${base}/api/comments`).then((res) => res.json()) as { comments: unknown[] };
    expect(review.comments).toEqual([comment]);
  } finally {
    await vite?.close();
    backend.stop(true);
    rmSync(cwd, { recursive: true, force: true });
    if (previousTarget === undefined) delete process.env.DIFFLE_API_TARGET;
    else process.env.DIFFLE_API_TARGET = previousTarget;
  }
});
