// fixed command words shared by the parser, help and shell completions.

export const MCP_ACTIONS = ["serve", "list", "restart"] as const;
export type McpAction = (typeof MCP_ACTIONS)[number];

export const HOOK_SUBCOMMANDS = ["stop"] as const;
export const HOOK_AGENTS = ["codex", "claude-code"] as const;
export type HookAgent = (typeof HOOK_AGENTS)[number];
