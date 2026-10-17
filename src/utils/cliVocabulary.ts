// fixed command words shared by the parser, help and shell completions.

export const MCP_ACTIONS = ["serve", "list", "restart"] as const;
export type McpAction = (typeof MCP_ACTIONS)[number];

export const HOOK_SUBCOMMANDS = ["stop"] as const;
export const HOOK_AGENTS = ["codex", "claude-code"] as const;
export type HookAgent = (typeof HOOK_AGENTS)[number];

export const COMPLETION_SHELLS = ["bash", "zsh", "fish", "powershell"] as const;
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

export const COMMANDS = ["review", "show", "mcp", "hook", "sessions", "cleanup", "update", "doctor", "setup", "completion"] as const;
export type CliCommand = (typeof COMMANDS)[number];

// agent ids `setup --agents` accepts. src/core/agentTargets.ts builds its targets from the same ids (tests/completion.test.ts checks they agree).
export const AGENT_IDS = ["claude", "codex", "cursor", "gemini", "vscode", "windsurf", "opencode", "zed", "copilot"] as const;
