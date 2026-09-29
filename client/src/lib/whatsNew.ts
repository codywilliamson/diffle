// what's-new highlights for the current release. auto-shown once per version the reviewer
// hasn't seen; the seen version persists server-side (state.json) via /api/state.

import { PRODUCT } from "$product";

const cmd = (args: string) => `"${PRODUCT.name} ${args}"`;

export const WHATS_NEW = {
  version: "0.25.0",
  highlights: [
    `New ${cmd("setup")} wires ${PRODUCT.name} into your coding agents: the Claude Code plugin, or an MCP config for others like Cursor. The installers offer it at the end, and ${cmd("setup --remove")} unwires it again.`,
    "The diff feels smoother: rows stagger in, the file tree row morphs into the diff header in single-file view, and the diff and comment counts animate as they change.",
    `Installing or updating on Windows now works even while ${PRODUCT.name} MCP servers or reviews are running; the running exe is moved aside instead of blocking the install.`,
    `${cmd("<command> --help")} now shows what each command does, with examples.`,
    `${cmd("update")} ends with a next-steps list, such as ${cmd("mcp restart")} so your agents pick up the new version.`,
  ],
};
