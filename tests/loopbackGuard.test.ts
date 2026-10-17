import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "bun";
import { createServer } from "../src/server/router";
import { directoryAssets } from "../src/server/assetSource";

let server: Server<undefined>;
let dir: string;
let port: number;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "nittle-loopback-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>nittle</title>");
  writeFileSync(join(dir, "app.js"), "console.log('nittle');");
  server = createServer({ diff: { ref: "working tree", files: [] }, cwd: dir, assets: directoryAssets(dir), productRoot: dir, newRef: null, diffArgs: [], includeUntracked: false, served: false, host: "cli" });
  port = server.port!;
});

afterAll(() => {
  server.stop(true);
  rmSync(dir, { recursive: true, force: true });
});

// fetch cannot forge Host, so talk raw http over a socket; returns status line + body
function raw(method: string, path: string, host: string | null, extra = ""): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1", () => {
      const hostLine = host === null ? "" : `Host: ${host}\r\n`;
      const body = method === "POST" ? "{}" : "";
      const version = host === null ? "1.0" : "1.1"; // bun itself 400s a 1.1 request without Host
      socket.write(`${method} ${path} HTTP/${version}\r\n${hostLine}${extra}Content-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`);
    });
    let data = "";
    socket.on("data", (chunk) => { data += chunk; });
    socket.on("close", () => resolve({ status: Number(data.split(" ")[1]), body: data.split("\r\n\r\n").slice(1).join("\r\n\r\n") }));
  });
}

const GET_ROUTES = ["/api/diff", "/api/state", "/api/review", "/api/comments", "/api/search?q=x", "/api/lsp/status", "/api/scorecard", "/api/presence", "/", "/app.js"];
const POST_ROUTES = ["/api/comments", "/api/viewed", "/api/state", "/api/session/stop"];

describe("loopback host guard (dns rebinding)", () => {
  for (const path of GET_ROUTES) {
    it(`GET ${path} refuses a foreign Host`, async () => {
      const res = await raw("GET", path, `evil.example:${port}`);
      expect(res.status).toBe(403);
      expect(res.body).toContain("host not allowed");
    });
  }

  for (const path of POST_ROUTES) {
    it(`POST ${path} refuses a foreign Host`, async () => {
      expect((await raw("POST", path, `evil.example:${port}`)).status).toBe(403);
    });
  }

  it("refuses malformed Host authorities", async () => {
    for (const host of [`evil.example@localhost:${port}`, `localhost:${port}/evil`, `localhost:${port}?x`, `localhost:${port}#x`, `localhost:${port}:${port}`, `localhost:${port} x`, `user:pw@127.0.0.1:${port}`]) {
      expect((await raw("GET", "/api/diff", host)).status).toBe(403);
    }
  });

  it("binds to loopback only", () => {
    expect(server.hostname).toBe("127.0.0.1");
  });

  it("refuses a missing Host", async () => {
    expect((await raw("GET", "/api/diff", null)).status).toBe(403);
  });

  it("refuses a loopback Host on the wrong port", async () => {
    expect((await raw("GET", "/api/diff", `localhost:${port + 1}`)).status).toBe(403);
    expect((await raw("GET", "/", `127.0.0.1:${port + 1}`)).status).toBe(403);
  });

  it("refuses a foreign Origin on a GET", async () => {
    const res = await raw("GET", "/api/diff", `localhost:${port}`, "Origin: http://evil.example\r\n");
    expect(res.status).toBe(403);
  });

  it("serves localhost, 127.0.0.1 and [::1] hosts on the listener port", async () => {
    for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]) {
      expect((await raw("GET", "/api/diff", host)).status).toBe(200);
      expect((await raw("GET", "/", host)).status).toBe(200);
      expect((await raw("GET", "/app.js", host)).status).toBe(200);
    }
  });

  it("accepts a matching Origin on a POST", async () => {
    const res = await raw("POST", "/api/viewed", `localhost:${port}`, `Origin: http://localhost:${port}\r\n`);
    expect(res.status).not.toBe(403);
  });
});
