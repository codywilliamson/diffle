// scriptable fake language server for tests. run with bun; behavior comes from the FAKE_LSP env
// var (json). it frames messages on its own (no src imports) so a framing bug in the client
// cannot be mirrored here.
//
// config: initDelayMs, encoding, stderrOnStart, exitOnInitialize (code), crashFirstN + counterFile
// (crash on initialize for the first N launches), progress {delayMs, durationMs}, clientRequests,
// ignoreExit (never leave on `exit`), ignoreShutdown (never answer `shutdown`).
// requests: fake/echo, fake/slow {ms} (answers -32800 when cancelled), fake/state, fake/crash,
// fake/partial (answers in tiny pieces with multibyte text), fake/burst (two frames in one write).
// navigation: responses {method: result} answers any other method with that canned result,
// hang [methods] never answers those until cancelled (-32800), delay {method: ms} answers a canned response late. fake/state also reports
// docs {uri: {version, text}}, changes [{uri, version, text}] and requests [{method, params}].

import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface Config {
  initDelayMs?: number; encoding?: string; stderrOnStart?: string; exitOnInitialize?: number;
  crashFirstN?: number; counterFile?: string; progress?: { delayMs: number; durationMs: number };
  clientRequests?: boolean; responses?: Record<string, unknown>; hang?: string[]; delay?: Record<string, number>; ignoreExit?: boolean; ignoreShutdown?: boolean; ignoreTerm?: boolean; spawnChild?: boolean;
}
interface Msg { id?: number | string; method?: string; params?: any; result?: unknown; error?: unknown }

const config: Config = JSON.parse(process.argv[2] ?? process.env.FAKE_LSP ?? "{}"); // argv wins, so two servers in one test can differ
const cancelled: Array<number | string> = [];
const opened: string[] = [];
const closed: string[] = [];
const docs: Record<string, { version: number; text: string }> = {};
const changes: Array<{ uri: string; version: number; text: string }> = [];
const requests: Array<{ method: string; params: unknown }> = [];
const replies: Record<string, unknown> = {};
let initParams: unknown;
let childPid: number | undefined;
if (config.ignoreTerm) process.on("SIGTERM", () => {});
const slow = new Map<number | string, Timer>();
let nextServerId = 1000;
let buffer = Buffer.alloc(0);

function frame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}
const send = (message: unknown) => process.stdout.write(frame(message));
const respond = (id: Msg["id"], result: unknown) => send({ jsonrpc: "2.0", id, result });
const fail = (id: Msg["id"], code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
const die = (code: number, why: string) => { process.stderr.write(why + "\n", () => process.exit(code)); };

function countLaunch(): number {
  const file = config.counterFile;
  if (!file) return 0;
  const seen = existsSync(file) ? Number(readFileSync(file, "utf8")) : 0;
  writeFileSync(file, String(seen + 1));
  return seen;
}

let progressEndedAt: number | null = null; // fake/state reports it so tests can tell a request waited for the load

function startProgress(): void {
  const { delayMs, durationMs } = config.progress!;
  setTimeout(() => {
    const token = "fake-progress";
    send({ jsonrpc: "2.0", id: nextServerId++, method: "window/workDoneProgress/create", params: { token } });
    send({ jsonrpc: "2.0", method: "$/progress", params: { token, value: { kind: "begin", title: "indexing" } } });
    setTimeout(() => { progressEndedAt = Date.now(); send({ jsonrpc: "2.0", method: "$/progress", params: { token, value: { kind: "end" } } }); }, durationMs);
  }, delayMs);
}

function askClient(): void {
  for (const [method, params] of [
    ["workspace/configuration", { items: [{ section: "dotnet.projects.enableAutomaticRestore" }, { section: "other" }] }],
    ["client/registerCapability", { registrations: [] }],
    ["window/workDoneProgress/create", { token: "t" }],
    ["fake/unknownToClient", {}],
  ] as const) send({ jsonrpc: "2.0", id: `srv-${method}`, method, params });
}

function onRequest(msg: Msg): unknown {
  const id = msg.id!;
  switch (msg.method) {
    case "initialize": {
      initParams = msg.params;
      if (config.spawnChild) childPid = Bun.spawn([process.execPath, "-e", "process.on(\"SIGTERM\",()=>{});setInterval(()=>{},1000)"], { stdio: ["ignore", "ignore", "ignore"] }).pid;
      if (config.exitOnInitialize !== undefined) return die(config.exitOnInitialize, "fake lsp: refusing to initialize");
      if (countLaunch() < (config.crashFirstN ?? 0)) return die(3, "fake lsp: crashing on purpose");
      if (config.stderrOnStart) process.stderr.write(config.stderrOnStart + "\n");
      const capabilities = config.encoding ? { positionEncoding: config.encoding } : {};
      return void setTimeout(() => respond(id, { capabilities, serverInfo: { name: "fake" } }), config.initDelayMs ?? 0);
    }
    case "shutdown": return config.ignoreShutdown ? undefined : respond(id, null);
    case "fake/echo": return respond(id, msg.params);
    case "fake/slow": return void slow.set(id, setTimeout(() => { slow.delete(id); respond(id, "done"); }, msg.params?.ms ?? 1000));
    case "fake/state": return respond(id, { cancelled, opened, closed, replies, initParams, childPid, docs, changes, requests, progressEndedAt });
    case "fake/crash": return die(1, "fake lsp: crash requested");
    case "fake/burst": return void process.stdout.write(Buffer.concat([frame({ jsonrpc: "2.0", id, result: "a" }), frame({ jsonrpc: "2.0", method: "fake/note", params: {} })]));
    case "fake/partial": {
      const bytes = frame({ jsonrpc: "2.0", id, result: "héllo 🌍 日本語" });
      let at = 0;
      const timer = setInterval(() => { process.stdout.write(bytes.subarray(at, at + 3)); at += 3; if (at >= bytes.length) clearInterval(timer); }, 2);
      return;
    }
    default: {
      requests.push({ method: msg.method!, params: msg.params });
      if (config.hang?.includes(msg.method!)) return void slow.set(id, setTimeout(() => { slow.delete(id); respond(id, null); }, 600_000));
      const wait = config.delay?.[msg.method!];
      if (wait && config.responses && msg.method! in config.responses) return void setTimeout(() => respond(id, config.responses![msg.method!]), wait);
      if (config.responses && msg.method! in config.responses) return respond(id, config.responses[msg.method!]);
      return fail(id, -32601, `no such method ${msg.method}`);
    }
  }
}

function onNotification(msg: Msg): void {
  if (msg.method === "$/cancelRequest") {
    const id = msg.params.id;
    cancelled.push(id);
    const timer = slow.get(id);
    if (timer) { clearTimeout(timer); slow.delete(id); fail(id, -32800, "cancelled"); }
  } else if (msg.method === "initialized") {
    if (config.progress) startProgress();
    if (config.clientRequests) askClient();
  } else if (msg.method === "textDocument/didOpen") {
    const { uri, version, text } = msg.params.textDocument;
    opened.push(uri);
    docs[uri] = { version, text };
  } else if (msg.method === "textDocument/didChange") {
    const { uri, version } = msg.params.textDocument;
    const text = msg.params.contentChanges[0].text;
    docs[uri] = { version, text };
    changes.push({ uri, version, text });
  }
  else if (msg.method === "textDocument/didClose") closed.push(msg.params.textDocument.uri);
  else if (msg.method === "exit" && !config.ignoreExit) process.exit(0);
}

function onMessage(msg: Msg): void {
  if (msg.method && msg.id !== undefined) onRequest(msg);
  else if (msg.method) onNotification(msg);
  else if (typeof msg.id === "string") replies[msg.id] = msg.error ?? msg.result;
}

process.stdin.on("data", (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const end = buffer.indexOf("\r\n\r\n");
    if (end < 0) return;
    const length = Number(/content-length: (\d+)/i.exec(buffer.subarray(0, end).toString("ascii"))![1]);
    if (buffer.length < end + 4 + length) return;
    const body = buffer.subarray(end + 4, end + 4 + length).toString("utf8");
    buffer = buffer.subarray(end + 4 + length);
    onMessage(JSON.parse(body));
  }
});
process.stdin.on("end", () => process.exit(0));
