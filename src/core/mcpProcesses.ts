// finds running `diffle mcp serve` processes by scanning the os process table. a registry
// wouldn't see servers started by older releases, and those are exactly the ones an update
// needs to replace. agents own the stdio pipe, so we can only stop a server — the agent
// relaunches it (with the new binary) when it reconnects.

import { basename, resolve } from "node:path";
import { PRODUCT } from "./product";
import { isProductBinary } from "../utils/installRoot";

export interface McpProcess {
  pid: number;
  path: string; // executable path (windows) or argv[0] as launched (unix)
}

const MCP_SERVE = /\s+mcp\s+serve\s*$/i;
const UNIX_PS_LINE = /^\s*(\d+)\s+(.*?)\s+mcp\s+serve\s*$/i;
const WINDOWS_QUERY = `Get-CimInstance Win32_Process -Filter "Name='${PRODUCT.name}.exe' OR Name='${PRODUCT.legacyName}.exe'" | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`;

interface CimRow { ProcessId: number; ExecutablePath: string | null; CommandLine: string | null; }

const isProductPath = (path: string) => isProductBinary(basename(path).replace(/^["']|["']$/g, ""));

// `ps -Ao pid=,args=` output → mcp servers. argv[0] may contain spaces (mcpb installs), so the
// path is everything between the pid and the trailing `mcp serve`.
export function parseUnixPs(output: string): McpProcess[] {
  return output.split("\n").flatMap((line) => {
    const match = UNIX_PS_LINE.exec(line);
    if (!match || !isProductPath(match[2]!)) return [];
    return [{ pid: Number(match[1]), path: match[2]! }];
  });
}

// ConvertTo-Json output → mcp servers. powershell emits a bare object for a single row.
export function parseWindowsCim(output: string): McpProcess[] {
  if (!output.trim()) return [];
  const parsed = JSON.parse(output) as CimRow | CimRow[];
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((row) =>
    row.ExecutablePath && row.CommandLine && MCP_SERVE.test(row.CommandLine)
      ? [{ pid: row.ProcessId, path: row.ExecutablePath }]
      : []);
}

// a bare command name was resolved through PATH, so it's the installed binary.
export function isOwnInstall(proc: McpProcess, execPath: string): boolean {
  if (!/[\\/]/.test(proc.path)) return true;
  const fold = (path: string) => (process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path));
  return fold(proc.path) === fold(execPath);
}

export function listMcpProcesses(): McpProcess[] {
  const windows = process.platform === "win32";
  const cmd = windows ? ["powershell", "-NoProfile", "-Command", WINDOWS_QUERY] : ["ps", "-Ao", "pid=,args="];
  const result = Bun.spawnSync(cmd, { stdin: "ignore", stderr: "ignore" });
  if (result.exitCode !== 0) throw new Error(`could not list processes (${cmd[0]} exited ${result.exitCode})`);
  const output = result.stdout.toString();
  return (windows ? parseWindowsCim(output) : parseUnixPs(output)).filter((proc) => proc.pid !== process.pid);
}

export function stopMcpProcess(pid: number): boolean {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}
