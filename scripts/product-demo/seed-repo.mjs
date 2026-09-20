// Builds the isolated demo repository: a committed baseline plus an agent-style working-tree
// change of exactly six files. One file (providerKeys.ts) carries a secret-shaped literal so
// Radar's local blocker lane has real evidence to redact.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };

// the pre-change baseline: what each file looked like before the agent touched it.
const BASELINE = {
  "src/server/sessionHandlers.ts": `export async function stopSession(id: string) {
  const session = readSession(id);
  if (!session) return false;
  await removeSession(id);
  return true;
}
`,
  "src/core/reviewRecords.ts": `export function writeRecord(file: string, record: object) {
  writeFileSync(file, JSON.stringify(record));
}
`,
  "src/client/reviewSync.js": `export function applyReview(previous, next) {
  setRecord(next);
}
`,
  "src/routes/billing.ts": `export function canRefund(user: User) {
  return user.role === "admin";
}
`,
  "README.md": "# Review service\n\nLocal review infrastructure.\n",
  "package.json": '{"name":"loupe-radar-demo","private":true,"type":"module"}\n',
};

// the agent's working-tree change: four rewrites plus two new files.
const CHANGES = {
  "src/server/sessionHandlers.ts": `export async function stopSession(id: string) {
  const session = readSession(id);
  if (!session) throw new Error("session missing");
  const child = children.get(id);
  child?.kill();
  await removeSession(id);
  return true;
}
`,
  "src/core/reviewRecords.ts": `export function writeRecord(file: string, record: object) {
  const temp = file + ".tmp";
  writeFileSync(temp, JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
  renameSync(temp, file);
}
`,
  "src/client/reviewSync.js": `export function applyReview(previous, next, generation) {
  if (generation !== generationRef.current) return;
  setRecord({ ...previous, ...next });
}
`,
  "src/routes/billing.ts": `export function canRefund(user: User, order: Order) {
  return user.role === "admin" || (user.id === order.ownerId && order.status === "paid");
}
`,
  "src/config/providerKeys.ts": `export const fallback = "sk-or-v1-9f2c0b4e1234567890abcdefghijklmnop";
`,
  "tests/sessionHandlers.test.ts": `import { test, expect } from "bun:test";
test("missing sessions throw", () => {
  expect(() => { throw new Error("session missing"); }).toThrow("session missing");
});
`,
};

export function seedRepo({ work, repo }) {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(repo, { recursive: true });
  const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  for (const [path, value] of Object.entries(BASELINE)) write(join(repo, path), value);
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Loupe Demo");
  git("config", "user.email", "demo@loupe.local");
  git("add", "-A");
  git("commit", "-q", "-m", "chore: establish radar demo baseline");
  for (const [path, value] of Object.entries(CHANGES)) write(join(repo, path), value);
}
