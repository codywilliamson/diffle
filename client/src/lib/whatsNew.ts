// what's-new highlights for the current release. auto-shown once per version the reviewer
// hasn't seen; the seen version persists server-side (state.json) via /api/state.
export const WHATS_NEW = {
  version: "0.25.0",
  highlights: [
    "New \"diffle setup\" wires diffle into your coding agents: the Claude Code plugin, or an MCP config for others like Cursor. The installers offer it at the end, and \"diffle setup --remove\" unwires it again.",
    "The diff feels smoother: rows stagger in, the file tree row morphs into the diff header in single-file view, and the diff and comment counts animate as they change.",
    "Installing or updating on Windows now works even while diffle MCP servers or reviews are running; the running exe is moved aside instead of blocking the install.",
    "\"diffle <command> --help\" now shows what each command does, with examples.",
    "\"diffle update\" ends with a next-steps list, such as \"diffle mcp restart\" so your agents pick up the new version.",
  ],
};
