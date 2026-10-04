// help text for the diffle cli: the overview plus per-command help.

import { PRODUCT } from "../../core/product";
import { COMMAND_HELP, renderCommandHelp, type HelpTopic } from "./commandHelp";

const TASKS: [string, string][] = [
  ["review the current changes", PRODUCT.name],
  [`wire ${PRODUCT.name} into your coding agents`, `${PRODUCT.name} setup`],
  ["after updating, reload the MCP server", `${PRODUCT.name} mcp restart`],
  ["reclaim stuck or finished reviews", `${PRODUCT.name} cleanup`],
  ["something looks off with the plugin", `${PRODUCT.name} doctor`],
];

const TOPICS = Object.keys(COMMAND_HELP) as HelpTopic[];
const usageLines = TOPICS.flatMap((topic) => COMMAND_HELP[topic].usage.map((line) => `  ${line}`));
const commandLines = TOPICS.map((topic) => `  ${(topic === "review" ? "(default)" : topic).padEnd(10)}  ${COMMAND_HELP[topic].summary}`);
const taskWidth = Math.max(...TASKS.map(([task]) => task.length));

export const USAGE = `${PRODUCT.name} — local git diff review with inline comments and LLM prompt export

Usage
${usageLines.join("\n")}

  (the deprecated \`${PRODUCT.legacyName}\` command and \`${PRODUCT.legacyEnvPrefix}*\` env vars still work for now)

Commands
${commandLines.join("\n")}

Common tasks
${TASKS.map(([task, command]) => `  ${task.padEnd(taskWidth)}  ${command}`).join("\n")}

Examples
  ${PRODUCT.name} staged --no-open   review staged changes without opening a browser
  ${PRODUCT.name} main               review this branch against main
  ${PRODUCT.name} browse src/        review the whole codebase under src/

Run \`${PRODUCT.name} <command> --help\` for a command's options and examples.
Docs: ${PRODUCT.site}/reference/cli/`;

// a bare review (or `<ref> --help`) gets the overview; `review --help` names the review command.
export function helpFor(command: HelpTopic, spec?: string): string {
  if (command !== "review") return renderCommandHelp(command);
  return spec === "review" ? renderCommandHelp("review") : USAGE;
}
