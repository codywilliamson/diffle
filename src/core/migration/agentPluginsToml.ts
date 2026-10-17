// line-based rewrite of retired mcp server tables in codex's config.toml. everything outside the
// touched `[mcp_servers.<retired>]` tables and their `command = "…"` lines is left byte-for-byte.
// the result is parsed before it is returned; an unparseable input or output is refused.

import { MCP_ARGS } from "../agentTargets";
import { PRODUCT } from "../product";
import { isRetiredCommand, isRetiredServerName, needsServeArgs } from "./retiredCommand";

const HEADER = /^\s*\[(?!\[)\s*mcp_servers\s*\.\s*(?:"([^"]+)"|([A-Za-z0-9_-]+))((?:\s*\.[^\]]*)?)\]/;
const ANY_HEADER = /^\s*\[/;
const COMMAND_LINE = /^(\s*command\s*=\s*)(?:"((?:[^"\\]|\\.)*)"|'([^']*)')(.*)$/s;
const ARGS_LINE = /^\s*args\s*=/;
const MULTILINE_DELIMITERS = ['"""', "'''"] as const;

interface Block { lines: string[]; server?: string; rest: string; }

export const isValidToml = (text: string): boolean => {
  try { Bun.TOML.parse(text); return true; } catch { return false; }
};

// tracks whether a line starts inside a multiline string, so its contents are never read as headers
function startsInsideString(lines: string[]): boolean[] {
  let open: string | undefined;
  return lines.map((line) => {
    const inside = open !== undefined;
    for (const delimiter of MULTILINE_DELIMITERS) {
      if (open !== undefined && open !== delimiter) continue;
      const count = line.split(delimiter).length - 1;
      if (count % 2 === 1) open = open === undefined ? delimiter : undefined;
    }
    return inside;
  });
}

function toBlocks(text: string): Block[] {
  const lines = text.split(/(?<=\n)/);
  const inside = startsInsideString(lines);
  const blocks: Block[] = [{ lines: [], rest: "" }];
  lines.forEach((line, index) => {
    if (!inside[index] && ANY_HEADER.test(line)) {
      const match = HEADER.exec(line);
      blocks.push({ lines: [line], server: match ? (match[1] ?? match[2]) : undefined, rest: match?.[3]?.trim() ?? "" });
    } else blocks[blocks.length - 1]!.lines.push(line);
  });
  return blocks;
}

const unescape = (value: string) => value.replace(/\\\\/g, "\\");

function blockCommand(block: Block): boolean {
  return block.lines.some((line) => {
    const match = COMMAND_LINE.exec(line);
    return match ? isRetiredCommand(unescape((match[2] ?? match[3])!)) : false;
  });
}

export const hasLegacyToml = (text: string): boolean =>
  toBlocks(text).some((block) => block.server !== undefined && (isRetiredServerName(block.server) || (block.rest === "" && blockCommand(block))));

function rewriteCommandLines(block: Block, command: string): void {
  const hasArgs = block.lines.some((line) => ARGS_LINE.test(line));
  block.lines = block.lines.flatMap((line) => {
    const match = COMMAND_LINE.exec(line);
    const old = match && unescape((match[2] ?? match[3])!);
    if (!match || !old || !isRetiredCommand(old)) return [line];
    const eol = /\r?\n$/.exec(match[4]!)?.[0] ?? "";
    const rewritten = `${match[1]}${JSON.stringify(command)}${match[4]!.replace(/\r?\n$/, "")}${eol}`;
    const argsLine = needsServeArgs(old) && !hasArgs ? [`args = ${JSON.stringify(MCP_ARGS)}${eol || "\n"}`] : [];
    return [rewritten, ...argsLine];
  });
}

const renameHeader = (line: string) =>
  line.replace(HEADER, (whole) => whole.replace(/mcp_servers\s*\.\s*(?:"[^"]+"|[A-Za-z0-9_-]+)/, `mcp_servers.${PRODUCT.name}`));

// an existing nittle table wins; otherwise the first retired server is renamed and the other
// retired servers are dropped, so the file never ends up with two tables of the same name.
// returns undefined (write nothing) when the input or the proposed output isn't valid toml.
export function rewriteLegacyToml(text: string, command: string): string | undefined {
  if (!isValidToml(text)) return undefined;
  const blocks = toBlocks(text);
  const retired = (block: Block) => block.server !== undefined && isRetiredServerName(block.server);
  const hasProduct = blocks.some((block) => block.server === PRODUCT.name);
  const keeper = hasProduct ? undefined : blocks.find(retired)?.server;
  const out: string[] = [];
  for (const block of blocks) {
    if (retired(block)) {
      if (block.server !== keeper) continue;
      block.lines[0] = renameHeader(block.lines[0]!);
    }
    if (block.server !== undefined && block.rest === "") rewriteCommandLines(block, command);
    out.push(...block.lines);
  }
  const result = out.join("");
  return isValidToml(result) ? result : undefined;
}
