// line-based rewrite of retired mcp server tables in codex's config.toml. everything outside the
// touched `[mcp_servers.<retired>]` tables and their `command = "…"` lines is left byte-for-byte.

import { MCP_ARGS } from "../agentTargets";
import { PRODUCT } from "../product";
import { isRetiredCommand, isRetiredServerName, needsServeArgs } from "./retiredCommand";

const HEADER = /^\s*\[(?!\[)\s*mcp_servers\s*\.\s*(?:"([^"]+)"|([A-Za-z0-9_-]+))((?:\s*\.[^\]]*)?)\]/;
const ANY_HEADER = /^\s*\[/;
const COMMAND_LINE = /^(\s*command\s*=\s*)(?:"((?:[^"\\]|\\.)*)"|'([^']*)')(.*)$/s;
const ARGS_LINE = /^\s*args\s*=/;

interface Block { lines: string[]; server?: string; rest: string; }

const lineStart = /(?<=\n)/;

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [{ lines: [], rest: "" }];
  for (const line of text.split(lineStart)) {
    if (ANY_HEADER.test(line)) {
      const match = HEADER.exec(line);
      blocks.push({ lines: [line], server: match ? (match[1] ?? match[2]) : undefined, rest: match?.[3]?.trim() ?? "" });
    } else blocks[blocks.length - 1]!.lines.push(line);
  }
  return blocks;
}

export const hasLegacyToml = (text: string): boolean =>
  toBlocks(text).some((block) => block.server !== undefined && (isRetiredServerName(block.server) || (block.rest === "" && blockCommand(block))));

function blockCommand(block: Block): boolean {
  return block.lines.some((line) => {
    const match = COMMAND_LINE.exec(line);
    return match ? isRetiredCommand((match[2] ?? match[3])!.replace(/\\\\/g, "\\")) : false;
  });
}

function rewriteCommandLines(block: Block, command: string): void {
  const hasArgs = block.lines.some((line) => ARGS_LINE.test(line));
  block.lines = block.lines.flatMap((line) => {
    const match = COMMAND_LINE.exec(line);
    const old = match && (match[2] ?? match[3])!.replace(/\\\\/g, "\\");
    if (!match || !old || !isRetiredCommand(old)) return [line];
    const eol = /\r?\n$/.exec(match[4]!)?.[0] ?? "";
    const rewritten = `${match[1]}${JSON.stringify(command)}${match[4]!.replace(/\r?\n$/, "")}${eol}`;
    const argsLine = needsServeArgs(old) && !hasArgs ? [`args = ${JSON.stringify(MCP_ARGS)}${eol || "\n"}`] : [];
    return [rewritten, ...argsLine];
  });
}

// returns the original text when there is nothing to rewrite
export function rewriteLegacyToml(text: string, command: string): string {
  const blocks = toBlocks(text);
  const hasProduct = blocks.some((block) => block.server === PRODUCT.name);
  const out: string[] = [];
  for (const block of blocks) {
    if (block.server !== undefined && isRetiredServerName(block.server)) {
      if (hasProduct) continue;
      block.lines[0] = block.lines[0]!.replace(HEADER, (whole) => whole.replace(/mcp_servers\s*\.\s*(?:"[^"]+"|[A-Za-z0-9_-]+)/, `mcp_servers.${PRODUCT.name}`));
    }
    if (block.server !== undefined && block.rest === "") rewriteCommandLines(block, command);
    out.push(...block.lines);
  }
  return out.join("");
}
