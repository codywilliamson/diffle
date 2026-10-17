// line-based rewrite of retired mcp server tables in codex's config.toml. everything outside the
// touched `[mcp_servers.<retired>]` tables and their `command = "…"` lines is left byte-for-byte.
// a small lexer decides which lines are real statements (not inside a multiline string, comments
// skipped), and the result is parsed before it is returned; unparseable input or output is refused.

import { MCP_ARGS } from "../agentTargets";
import { PRODUCT } from "../product";
import { isRetiredCommand, isRetiredServerName, needsServeArgs } from "./retiredCommand";

const HEADER = /^\s*\[(?!\[)\s*mcp_servers\s*\.\s*(?:"([^"]+)"|([A-Za-z0-9_-]+))((?:\s*\.[^\]]*)?)\]/;
const ANY_HEADER = /^\s*\[/;
const COMMAND_LINE = /^(\s*command\s*=\s*)(?:"((?:[^"\\]|\\.)*)"|'([^']*)')(.*)$/s;
const ARGS_LINE = /^\s*args\s*=/;

type Mode = "normal" | "basic" | "literal" | "multiBasic" | "multiLiteral";
interface Line { text: string; real: boolean; }
interface Block { lines: Line[]; server?: string; rest: string; }

export const isValidToml = (text: string): boolean => {
  try { Bun.TOML.parse(text); return true; } catch { return false; }
};

// for each line: does it start outside any string? (# comments and quotes inside them are skipped)
export function statementStarts(text: string): boolean[] {
  const starts = [true];
  let mode: Mode = "normal";
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === "\n") {
      if (mode === "basic" || mode === "literal") mode = "normal";
      starts.push(mode === "normal");
      continue;
    }
    if (mode === "normal") {
      if (char === "#") { while (i + 1 < text.length && text[i + 1] !== "\n") i++; }
      else if (text.startsWith('"""', i)) { mode = "multiBasic"; i += 2; }
      else if (text.startsWith("'''", i)) { mode = "multiLiteral"; i += 2; }
      else if (char === '"') mode = "basic";
      else if (char === "'") mode = "literal";
    } else if (mode === "basic" || mode === "multiBasic") {
      if (char === "\\") { if (text[i + 1] === "\n") starts.push(false); i++; }
      else if (mode === "multiBasic" && text.startsWith('"""', i)) { mode = "normal"; i += 2; }
      else if (mode === "basic" && char === '"') mode = "normal";
    } else if (mode === "literal") {
      if (char === "'") mode = "normal";
    } else if (text.startsWith("'''", i)) {
      mode = "normal";
      i += 2;
    }
  }
  return starts;
}

function toBlocks(text: string): Block[] {
  const rawLines = text.split(/(?<=\n)/);
  const starts = statementStarts(text);
  const blocks: Block[] = [{ lines: [], rest: "" }];
  rawLines.forEach((raw, index) => {
    const real = starts[index] ?? true;
    if (real && ANY_HEADER.test(raw)) {
      const match = HEADER.exec(raw);
      blocks.push({ lines: [{ text: raw, real }], server: match ? (match[1] ?? match[2]) : undefined, rest: match?.[3]?.trim() ?? "" });
    } else blocks[blocks.length - 1]!.lines.push({ text: raw, real });
  });
  return blocks;
}

const unescape = (value: string) => value.replace(/\\\\/g, "\\");

function commandOf(line: Line): { match: RegExpExecArray; old: string } | undefined {
  const match = line.real ? COMMAND_LINE.exec(line.text) : null;
  return match ? { match, old: unescape((match[2] ?? match[3])!) } : undefined;
}

export const hasLegacyToml = (text: string): boolean =>
  toBlocks(text).some((block) => block.server !== undefined && (
    isRetiredServerName(block.server) ||
    (block.rest === "" && block.lines.some((line) => isRetiredCommand(commandOf(line)?.old)))
  ));

function rewriteCommandLines(block: Block, command: string): void {
  const hasArgs = block.lines.some((line) => line.real && ARGS_LINE.test(line.text));
  block.lines = block.lines.flatMap((line) => {
    const found = commandOf(line);
    if (!found || !isRetiredCommand(found.old)) return [line];
    const { match, old } = found;
    const eol = /\r?\n$/.exec(match[4]!)?.[0] ?? "";
    const text = `${match[1]}${JSON.stringify(command)}${match[4]!.replace(/\r?\n$/, "")}${eol}`;
    const args = needsServeArgs(old) && !hasArgs ? [{ text: `args = ${JSON.stringify(MCP_ARGS)}${eol || "\n"}`, real: true }] : [];
    return [{ text, real: true }, ...args];
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
      block.lines[0]!.text = renameHeader(block.lines[0]!.text);
    }
    if (block.server !== undefined && block.rest === "") rewriteCommandLines(block, command);
    out.push(...block.lines.map((line) => line.text));
  }
  const result = out.join("");
  return isValidToml(result) ? result : undefined;
}
