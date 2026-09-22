// records a post-publish installer failure without opening a duplicate issue on rerun.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tag = process.env.TAG;
const runner = process.env.RUNNER_OS;
const repository = process.env.GITHUB_REPOSITORY;
if (!tag || !runner || !repository) throw new Error("TAG, RUNNER_OS, and GITHUB_REPOSITORY are required");

const root = join(import.meta.dir, "..");
const tempRoot = process.env.RUNNER_TEMP ?? tmpdir();
const logPath = join(tempRoot, "diffle-installer-smoke.log");
const title = `bug: ${tag} installer smoke failed on ${runner}`;
const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "installer smoke produced no log";
const excerpt = log.replaceAll("\r", "").split("\n").slice(-80).join("\n").slice(-8_000);
const runUrl = `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID ?? "unknown"}`;
const bodyPath = join(tempRoot, "diffle-installer-smoke-issue.md");
writeFileSync(bodyPath, `The published ${tag} installer failed on ${runner}. The release is already public.\n\nRun: ${runUrl}\n\n\`\`\`text\n${excerpt}\n\`\`\`\n`);

function gh(args: string[]): string {
  const result = Bun.spawnSync(["gh", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`gh ${args.join(" ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}

const issues = JSON.parse(gh(["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title"])) as { number: number; title: string }[];
const existing = issues.find((issue) => issue.title === title);
const args = existing
  ? ["issue", "comment", String(existing.number), "--body-file", bodyPath]
  : ["issue", "create", "--title", title, "--label", "bug", "--body-file", bodyPath];
console.log(gh(args));
