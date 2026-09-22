// `diffle mcp list` and `diffle mcp restart` — find and stop running MCP servers so agents
// relaunch them (e.g. on the new binary after an update).

import { classifySessions } from "../core/sessions";
import { isOwnInstall, listMcpProcesses, stopMcpProcess, type McpProcess } from "../core/mcpProcesses";
import { PRODUCT } from "../core/product";
import { confirmProceed } from "./confirm";

const NO_SERVERS = `no ${PRODUCT.name} MCP servers running`;
const RECONNECT_HINT = "agents start the new server on reconnect (Claude Code: /mcp → reconnect, or a new session)";
const RESTART_COMMAND = `${PRODUCT.name} mcp restart`;
const tag = `[${PRODUCT.name}]`;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// a live review may be hosted inside an MCP server, so stopping one is only safe when no
// session is live (stale entries are fine — nothing is serving them).
export async function liveSessionCount(): Promise<number> {
  return (await classifySessions()).live.length;
}

// stops each server; returns the ones that couldn't be stopped.
export function stopMcpServers(servers: McpProcess[], stop = stopMcpProcess): McpProcess[] {
  return servers.filter((server) => !stop(server.pid));
}

export function runMcpListCommand(): void {
  const servers = listMcpProcesses();
  if (servers.length === 0) return console.log(NO_SERVERS);
  const width = Math.max(3, ...servers.map((server) => String(server.pid).length));
  console.log(`${"PID".padEnd(width)}  PATH`);
  for (const server of servers) console.log(`${String(server.pid).padEnd(width)}  ${server.path}`);
}

export async function runMcpRestartCommand(opts: { yes: boolean }): Promise<void> {
  const servers = listMcpProcesses();
  if (servers.length === 0) return console.log(NO_SERVERS);
  const live = await liveSessionCount();
  if (live > 0) {
    console.log(`${plural(live, "live review session")} — finish or stop them first (${PRODUCT.name} sessions / cleanup --all)`);
    process.exit(1);
  }

  console.log("plan:");
  for (const server of servers) console.log(`  stop MCP server pid ${server.pid} (${server.path})`);
  if (!(await confirmProceed(opts.yes))) return;

  const failed = stopMcpServers(servers);
  if (failed.length > 0) {
    console.log("failed to stop:");
    for (const server of failed) console.log(`  pid ${server.pid} (${server.path})`);
    process.exit(1);
  }
  console.log(`stopped ${plural(servers.length, "MCP server")} — ${RECONNECT_HINT}`);
}

// after `update` swaps the binary, old servers of this install keep running the previous version
// until relaunched. stops them unless a review is live; never fails the update itself.
export async function restartMcpAfterUpdate(execPath: string): Promise<void> {
  try {
    const servers = listMcpProcesses().filter((server) => isOwnInstall(server, execPath));
    if (servers.length === 0) return;
    const live = await liveSessionCount();
    if (live > 0) {
      return console.log(`${tag} ${plural(servers.length, "MCP server")} still on the old version — ${plural(live, "live review session")} open; run ${RESTART_COMMAND} once they finish`);
    }
    const failed = stopMcpServers(servers);
    const stopped = servers.length - failed.length;
    if (stopped > 0) console.log(`${tag} stopped ${plural(stopped, "MCP server")} — ${RECONNECT_HINT}`);
    if (failed.length > 0) console.log(`${tag} couldn't stop pid ${failed.map((server) => server.pid).join(", ")} — run ${RESTART_COMMAND}`);
  } catch (err) {
    console.log(`${tag} couldn't check for running MCP servers (${err instanceof Error ? err.message : String(err)}) — run ${RESTART_COMMAND}`);
  }
}
