// recognises the retired product identities (diffle, loupe) in mcp server names and commands.

import { PRODUCT } from "../product";

const RETIRED: readonly string[] = PRODUCT.retiredNames;
const MCP_SUFFIX = "-mcp";
const SERVE_TAIL = /\s+mcp\s+serve\s*$/i;

// `"C:\Users\u\.diffle\bin\diffle.exe"` / `/x/diffle-mcp` / `diffle mcp serve` -> `diffle` / `diffle-mcp` / `diffle`
export function commandBaseName(command: string): string {
  const bare = command.trim().replace(/^["']|["']$/g, "").replace(SERVE_TAIL, "");
  return (bare.split(/[\\/]/).pop() ?? "").replace(/\.exe$/i, "").toLowerCase();
}

export function isRetiredCommand(command: string | undefined): boolean {
  if (!command) return false;
  const base = commandBaseName(command);
  return RETIRED.includes(base) || RETIRED.some((name) => base === `${name}${MCP_SUFFIX}`);
}

// `diffle-mcp` and `diffle mcp serve` carried no separate args, so the replacement needs `mcp serve` spelled out
export const needsServeArgs = (command: string): boolean => commandBaseName(command).endsWith(MCP_SUFFIX) || SERVE_TAIL.test(command);

export function isRetiredServerName(name: string): boolean {
  return RETIRED.some((retired) => name === retired || name === `${retired}-review`);
}
