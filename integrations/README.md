# Nittle integrations

These adapters launch the local stdio MCP server and provide review-session
context. Review Records and the browser remain Nittle's source of truth.

Codex and Claude Code each ship two packages:

- `nittle-review` — the explicit skill plus local MCP configuration.

Install the explicit package by default. Add the hook package only when automatic
completion review is desired; a user interrupt bypasses the hook, and an existing
active Review Record prevents duplicate launches.

## Local installation

`nittle setup` installs these for you (and wires the MCP server into other agents); the commands below are the manual equivalent.

Register the marketplace, then install the explicit review plugin:

```text
codex plugin marketplace add codywilliamson/diffle
codex plugin add nittle-review@nittle-local

claude plugin marketplace add codywilliamson/diffle
claude plugin install nittle-review@nittle-local --scope user
```


The plugin was called `diffle-review` before the rename (formerly diffle). nittle replaces it on first run. The marketplace slug stays `codywilliamson/diffle` until the GitHub repo is renamed.

Newly installed Codex plugins load in a new task. Claude Code loads them in a new
session or after `/reload-plugins`.
