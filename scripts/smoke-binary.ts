// exercises a release binary outside the checkout before its draft is published.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { PRODUCT } from "../src/core/product";

const source = process.argv[2];
const tag = process.env.TAG;
if (!source || !tag?.startsWith("v")) throw new Error("usage: TAG=vX.Y.Z bun scripts/smoke-binary.ts <binary>");

const version = tag.slice(1);
const temp = mkdtempSync(join(tmpdir(), "diffle-release-smoke-"));
const binary = join(temp, basename(source));
const env = { ...process.env, DIFFLE_NO_UPDATE_CHECK: "1", DIFFLE_DATA_DIR: join(temp, "data") } as Record<string, string>;

function run(command: string, args: string[], cwd: string): string {
  const result = Bun.spawnSync([command, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

async function checkCli(repo: string): Promise<void> {
  const server = Bun.spawn([binary, "--no-open"], { cwd: repo, env, stdout: "pipe", stderr: "inherit" });
  const reader = server.stdout.getReader();
  const timer = setTimeout(() => server.kill(), 15_000);
  try {
    let output = "";
    let url: string | undefined;
    while (!url) {
      const next = await reader.read();
      if (next.done) throw new Error(`review server exited before launch: ${output}`);
      output += new TextDecoder().decode(next.value);
      url = output.match(/http:\/\/localhost:\d+\/\?review=[\w-]+/)?.[0];
    }

    const base = new URL(url).origin;
    const diff = await fetch(`${base}/api/diff`, { signal: AbortSignal.timeout(10_000) });
    if (!diff.ok) throw new Error(`/api/diff returned ${diff.status}`);
    const data = await diff.json() as { files?: { path: string }[] };
    if (!data.files?.some((file) => file.path === "a.ts")) throw new Error("/api/diff omitted the changed file");

    const index = await fetch(base, { signal: AbortSignal.timeout(10_000) });
    if (!index.ok) throw new Error(`embedded client returned ${index.status}`);
    const asset = (await index.text()).match(/src="([^"]+\.js)"/)?.[1];
    if (!asset) throw new Error("embedded client HTML has no JavaScript asset");
    const script = await fetch(new URL(asset, base), { signal: AbortSignal.timeout(10_000) });
    if (!script.ok) throw new Error(`embedded JavaScript returned ${script.status}`);
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
    server.kill();
    await server.exited;
  }
}

try {
  copyFileSync(resolve(source), binary);
  chmodSync(binary, 0o755);
  const reported = run(binary, ["--version"], temp);
  if (reported !== `${PRODUCT.name} v${version}`) throw new Error(`expected ${PRODUCT.name} v${version}, got ${reported}`);

  const transport = new StdioClientTransport({ command: binary, args: ["mcp", "serve"], cwd: temp, env });
  const client = new Client({ name: "diffle-release-smoke", version: "1" });
  try {
    await client.connect(transport);
    const server = client.getServerVersion();
    if (server?.name !== PRODUCT.name || server.version !== version) throw new Error(`unexpected MCP identity: ${JSON.stringify(server)}`);
    const tools = await client.listTools();
    if (!tools.tools.some((tool) => tool.name === "start_review")) throw new Error("MCP tools omit start_review");
  } finally {
    await client.close();
  }

  const repo = join(temp, "repo");
  mkdirSync(repo);
  run("git", ["init", "-q", "-b", "main"], repo);
  run("git", ["config", "user.name", "release smoke"], repo);
  run("git", ["config", "user.email", "smoke@example.invalid"], repo);
  writeFileSync(join(repo, "a.ts"), "one\n");
  run("git", ["add", "a.ts"], repo);
  run("git", ["commit", "-q", "-m", "init"], repo);
  writeFileSync(join(repo, "a.ts"), "two\n");
  await checkCli(repo);
  console.log(`release binary smoke passed: ${tag}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
