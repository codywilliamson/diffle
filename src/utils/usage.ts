// help text for the diffle cli.

import { PRODUCT } from "../core/product";
import { UPDATE_CHECK_OPT_OUT } from "../core/updateNotice";

export const USAGE = `${PRODUCT.name} — local git diff review with inline comments and LLM prompt export

Usage
  ${PRODUCT.name} [ref] [options]
  ${PRODUCT.name} mcp <serve|list|restart> [--yes]
  ${PRODUCT.name} hook stop --agent <codex|claude-code>
  ${PRODUCT.name} sessions
  ${PRODUCT.name} cleanup [--yes] [--all]
  ${PRODUCT.name} update [--check]
  ${PRODUCT.name} doctor [--fix] [--yes]
  ${PRODUCT.name} setup [--remove] [--agents <ids>] [--yes]

  (the deprecated \`${PRODUCT.legacyName}\` command and \`${PRODUCT.legacyEnvPrefix}*\` env vars still work for now)

Refs
  (none)            working tree vs HEAD, untracked files included
  staged            staged changes only
  <branch>          current branch vs <branch> (pr-style three-dot)
  <ref1>..<ref2>    commit range
  browse [path]     review the whole codebase (optionally scoped to a path)

Session commands
  sessions          list running ${PRODUCT.name} sessions (host, port, age, live/stale)
  cleanup           stop stale sessions and finished reviews
      --yes         skip the confirmation prompt
      --all         also stop active (not just finished/stale) sessions

MCP server
  mcp serve         run the local stdio MCP server (agents launch this)
  mcp list          list running ${PRODUCT.name} MCP servers
  mcp restart       stop running MCP servers so agents relaunch them on reconnect
      --yes         skip the confirmation prompt

Updates
  update            download and install the latest release, then restart idle MCP servers
      --check       only report whether a newer release exists
  (a new release is announced at launch; set ${PRODUCT.envPrefix}${UPDATE_CHECK_OPT_OUT}=1 to silence it)

Diagnostics
  doctor            check the Claude Code plugin install for stale ${PRODUCT.legacyName} leftovers
      --fix         run the repair commands through the \`claude\` cli
      --yes         skip the confirmation prompt

Agent setup
  setup             wire ${PRODUCT.name} into your coding agents (plugin or MCP config)
      --agents <ids>  comma-separated agent ids, skips the prompt (e.g. claude,cursor)
      --remove      unwire ${PRODUCT.name} instead
      --yes         skip the confirmation prompt

Options
  -p, --port <n>    serve on a fixed port (default: any free port)
      --no-open     don't open the browser automatically
      --review-id   open an existing durable Review Record
  -v, --version     print the installed version
      --license     print the bundled MIT license notice
  -h, --help        show this help

Comments are saved to .review in the current directory and compile into a
structured review prompt from the UI.`;
