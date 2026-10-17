// seeds what a real 0.28.1 user has by the time they run `diffle update`: review records with
// comments, replies, rounds and addressed state (written in the 0.28.1 record format, since the
// binary has no headless way to author them), state.json prefs, and agent configs that launch
// `diffle mcp serve`. returns the originals so the assertions can compare them after the upgrade.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Seeded {
  records: Record<string, unknown>; // id -> record as written
  state: Record<string, unknown>;
  agentFiles: string[]; // configs that must stop mentioning diffle
  untouched: Record<string, unknown>; // unrelated mcp servers that must survive
}

// a bashrc with the user's own lines, so the assertions can prove the migration left them alone
export const PROFILE_LINES = ["# my shell", "alias ll='ls -l'", "export EDITOR=vim", ""].join("\n");
export const profilePath = (home: string) => join(home, ".bashrc");
export function seedShellProfile(home: string): void {
  writeFileSync(profilePath(home), PROFILE_LINES);
}

const AT = "2026-09-01T10:00:00.000Z";
const comment = (id: string, extra: Record<string, unknown> = {}) => ({
  id, file: "src/app.ts", line: 12, lineContent: "+const answer = 42;", text: `comment ${id}`, tag: "issue", createdAt: AT, ...extra,
});

function records(cwd: string): Record<string, unknown> {
  const base = { schemaVersion: 1, target: { cwd, ref: "main" }, policy: "required", createdAt: AT, updatedAt: AT, viewed: ["src/app.ts"] };
  return {
    "smoke-awaiting": { ...base, id: "smoke-awaiting", status: "awaiting_human", summary: "first pass", comments: [comment("c1"), comment("c2", { line: null, lineContent: null, tag: "nit" })], activity: [{ id: "a1", type: "review_started", actor: "system", createdAt: AT }] },
    "smoke-addressed": {
      ...base, id: "smoke-addressed", status: "feedback_ready", origin: { agent: "claude-code", sessionId: "s1", originalRequest: "add the answer" },
      comments: [
        comment("c3", { status: "addressed", replies: [{ id: "r1", author: "agent", text: "done in abc123", createdAt: AT }] }),
        comment("c4", { status: "resolved", resolved: true, replies: [{ id: "r2", author: "reviewer", text: "thanks", createdAt: AT }] }),
      ],
      activity: [{ id: "a2", type: "feedback_returned", actor: "reviewer", createdAt: AT }, { id: "a3", type: "comment_addressed", actor: "agent", commentId: "c3", createdAt: AT }],
      lastRound: { capturedAt: AT, blobs: { "src/app.ts": "4b825dc642cb", "gone.ts": null } },
    },
    "smoke-approved": { ...base, id: "smoke-approved", status: "approved", comments: [], activity: [{ id: "a4", type: "review_approved", actor: "reviewer", createdAt: AT }] },
  };
}

const writeJson = (path: string, value: unknown) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); };

export function seedDiffleHome(home: string, codexHome: string, diffleBinary: string): Seeded {
  const dataDir = join(home, ".diffle");
  const all = records(join(home, "repo"));
  for (const [id, record] of Object.entries(all)) writeJson(join(dataDir, "reviews", id, "review.json"), record);
  const state = { seenVersion: "0.28.1", updateCheckedAt: AT, latestKnownVersion: "0.28.1" };
  writeJson(join(dataDir, "state.json"), state);

  const other = { command: "other-mcp", args: ["--flag"] };
  const cursor = join(home, ".cursor", "mcp.json");
  writeJson(cursor, { mcpServers: { other, diffle: { command: diffleBinary, args: ["mcp", "serve"] } } });
  const vscode = join(home, ".config", "Code", "User", "mcp.json");
  const vscodeWin = join(home, "AppData", "Roaming", "Code", "User", "mcp.json");
  const vscodePath = process.platform === "win32" ? vscodeWin : process.platform === "darwin" ? join(home, "Library", "Application Support", "Code", "User", "mcp.json") : vscode;
  writeJson(vscodePath, { servers: { other: { type: "stdio", ...other }, diffle: { type: "stdio", command: diffleBinary, args: ["mcp", "serve"] } } });
  const codex = join(codexHome, "config.toml");
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(codex, `model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "other-mcp"\nargs = ["--flag"]\n\n[mcp_servers.diffle-review]\ncommand = ${JSON.stringify(diffleBinary)}\nargs = ["mcp", "serve"]\n`);

  return {
    records: all, state, agentFiles: [cursor, vscodePath, codex], untouched: { other },
  };
}
