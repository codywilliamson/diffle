import { afterEach, describe, expect, it } from "bun:test";
import { chmodSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { delimiter, join } from "node:path";
import type { Server } from "bun";
import { LspPool } from "../src/core/lsp/pool";
import { findExecutable } from "../src/core/lsp/which";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";
import { FAKE_LSP_PATH, fakeEntry, scriptFake, tempDir } from "./helpers/fakeLspPool";

const WIN = process.platform === "win32";
const NAME = "typescript-language-server";

// writes an executable named like the real server; `body` is a shell line (posix) or cmd line (windows)
function writeShim(dir: string, posixBody: string, cmdBody: string): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, WIN ? `${NAME}.cmd` : NAME);
  writeFileSync(file, WIN ? `@echo off\r\n${cmdBody}\r\n` : `#!/bin/sh\n${posixBody}\n`);
  if (!WIN) chmodSync(file, 0o755);
  return file;
}
const trapShim = (dir: string, marker: string) => writeShim(dir, `echo ran > "${marker}"`, `echo ran> "${marker}"`);
const legitShim = (dir: string) => writeShim(dir, `exec "${process.execPath}" "${FAKE_LSP_PATH}" "$@"`, `"${process.execPath}" "${FAKE_LSP_PATH}" %*`);
const pool = (root: string, searchPath: string) =>
  new LspPool({ root, searchPath, registry: { typescript: { ...fakeEntry(), candidates: [{ command: NAME, args: () => [] }] } } });

const pools: LspPool[] = [];
afterEach(() => { for (const p of pools.splice(0)) p.killAll(); delete process.env.FAKE_LSP; });

describe("server lookup never runs a binary from the repository", () => {
  it("skips a planted shim on PATH and uses the legitimate install behind it", async () => {
    scriptFake({});
    const repo = tempDir("repo"); const outside = tempDir("outside"); const markers = tempDir("markers");
    const marker = join(markers, "ran");
    trapShim(join(repo, "node_modules", ".bin"), marker);
    const legit = legitShim(join(outside, "bin"));
    const p = pool(repo, [join(repo, "node_modules", ".bin"), join(outside, "bin")].join(delimiter));
    pools.push(p);
    expect(p.status(["typescript"])[0]?.server).toBe(legit);
    expect(await p.ensure("typescript")).toBeDefined();
    expect(existsSync(marker)).toBe(false);
  });

  it("with only the planted shim the language is missing, says why, and nothing runs", async () => {
    const repo = tempDir("repo"); const markers = tempDir("markers");
    const marker = join(markers, "ran");
    trapShim(join(repo, "bin"), marker);
    const p = pool(repo, join(repo, "bin"));
    pools.push(p);
    const [status] = p.status(["typescript"]);
    expect(status?.state).toBe("missing");
    expect(status?.hint).toContain("ignored a server inside the repository");
    expect(await p.ensure("typescript")).toBeUndefined();
    expect(existsSync(marker)).toBe(false);
  });

  it("refuses a worktree of the repository too", () => {
    const repo = tempDir("repo"); const sibling = tempDir("sibling");
    const shim = trapShim(join(sibling, "bin"), join(sibling, "ran"));
    const found = findExecutable(NAME, { searchPath: join(sibling, "bin"), excludeRoots: [repo, sibling] });
    expect(found).toEqual({ path: undefined, rejected: true });
    expect(existsSync(shim)).toBe(true);
  });

  it.skipIf(WIN)("resolves symlinks: a PATH entry outside the repo that points into it is refused", () => {
    const repo = tempDir("repo"); const outside = tempDir("outside");
    const real = trapShim(join(repo, "bin"), join(outside, "ran"));
    mkdirSync(join(outside, "bin"));
    symlinkSync(real, join(outside, "bin", NAME));
    expect(findExecutable(NAME, { searchPath: join(outside, "bin"), excludeRoots: [repo] }).rejected).toBe(true);
  });
});

describe("GET /api/lsp/status guards", () => {
  let server: Server<undefined> | undefined;
  afterEach(() => server?.stop(true));
  const start = () => {
    const cwd = tempDir("router");
    server = createServer({ diff: { ref: "working tree", files: [] }, cwd, assets: directoryAssets(cwd), productRoot: cwd, newRef: null, diffArgs: [], includeUntracked: false, served: false, host: "cli" });
    return server.port!;
  };
  const rawGet = (port: number, host: string) => new Promise<string>((resolve) => {
    const socket = connect(port, "127.0.0.1", () => socket.write(`GET /api/lsp/status HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`));
    let data = "";
    socket.on("data", (chunk) => { data += chunk; });
    socket.on("close", () => resolve(data.split("\r\n")[0] ?? ""));
  });

  it("serves a same-origin request", async () => {
    const port = start();
    expect((await fetch(`http://localhost:${port}/api/lsp/status`)).status).toBe(200);
    expect(await rawGet(port, `127.0.0.1:${port}`)).toContain("200");
  });

  it("rejects a foreign Origin", async () => {
    const port = start();
    const res = await fetch(`http://localhost:${port}/api/lsp/status`, { headers: { Origin: "http://evil.example" } });
    expect(res.status).toBe(403);
  });

  it("rejects a foreign Host (dns rebinding)", async () => {
    const port = start();
    expect(await rawGet(port, `evil.example:${port}`)).toContain("403");
  });
});

describe.skipIf(!WIN)("windows cleanup never runs a planted taskkill", () => {
  it("killAll uses the system taskkill, not a taskkill.cmd first on PATH", async () => {
    // bun snapshots PATH at startup, so the planted entry has to be there when the process starts
    const repo = tempDir("repo"); const markers = tempDir("markers");
    const marker = join(markers, "ran");
    const bin = join(repo, "node_modules", ".bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "taskkill.cmd"), `@echo off\r\necho ran> "${marker}"\r\n`);
    const child = Bun.spawn([process.execPath, join(import.meta.dir, "fixtures", "killTreeChild.ts")], {
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` }, stdout: "pipe", stderr: "pipe",
    });
    expect(await new Response(child.stdout).text()).toContain("killed");
    await child.exited;
    expect(existsSync(marker)).toBe(false);
  });
});
