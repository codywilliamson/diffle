# Diffle integrations

These adapters launch the local stdio MCP server and provide review-session
context. Review Records and the browser remain Diffle's source of truth.

Codex and Claude Code each ship two packages:

- `diffle-review` — the explicit skill plus local MCP configuration.

Install the explicit package by default. Add the hook package only when automatic
completion review is desired; a user interrupt bypasses the hook, and an existing
active Review Record prevents duplicate launches.

## Local installation

Register the marketplace, then install the explicit review plugin:

```text
codex plugin marketplace add codywilliamson/diffle
codex plugin add diffle-review@diffle-local

claude plugin marketplace add codywilliamson/diffle
claude plugin install diffle-review@diffle-local --scope user
```


Newly installed Codex plugins load in a new task. Claude Code loads them in a new
session or after `/reload-plugins`.
