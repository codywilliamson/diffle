import { basename, join } from "node:path";
import type { ReviewOrigin } from "../types";
import { PRODUCT } from "./product";
import { productEnv } from "../utils/env";
import { isProductBinary } from "../utils/installRoot";
import { createReviewRecord, findActiveReviewForOrigin } from "./reviewRecords";
import { loadReviewTarget } from "./reviewTarget";

interface HookPayload {
  cwd?: string;
  session_id?: string;
  task_id?: string;
  last_assistant_message?: string;
}

function childCommand(loupeRoot: string, reviewId: string): string[] {
  return isProductBinary(basename(process.execPath))
    ? [process.execPath, "--review-id", reviewId]
    : [process.execPath, join(loupeRoot, "src", "index.ts"), "--review-id", reviewId];
}

async function performCompletionHook(agent: ReviewOrigin["agent"], loupeRoot: string): Promise<void> {
  let payload: HookPayload = {};
  try { payload = JSON.parse(await Bun.stdin.text()) as HookPayload; } catch { /* use cwd fallback */ }
  const cwd = payload.cwd ?? process.cwd();
  const origin: ReviewOrigin = { agent, ...(payload.session_id ? { sessionId: payload.session_id } : {}), ...(payload.task_id ? { taskId: payload.task_id } : {}), ...(payload.last_assistant_message ? { summary: payload.last_assistant_message } : {}) };
  const active = findActiveReviewForOrigin(cwd, origin);
  if (active) return console.log(JSON.stringify({ systemMessage: `${PRODUCT.displayName} ${active.id} is still active.` }));
  const loaded = loadReviewTarget(cwd);
  if (loaded.diff.files.length === 0) return;
  const record = createReviewRecord({ target: { cwd, ref: loaded.diff.ref, ...(loaded.meta ? { meta: loaded.meta } : {}) }, policy: "required", origin });
  if (productEnv("HOOK_NO_SPAWN") !== "1") {
    const command = childCommand(loupeRoot, record.id);
    if (productEnv("NO_OPEN") === "1") command.push("--no-open");
    const child = Bun.spawn(command, { cwd, env: { ...process.env, [`${PRODUCT.envPrefix}SESSION_HOST`]: "hook" }, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
    child.unref();
  }
  console.log(JSON.stringify({ systemMessage: `${PRODUCT.displayName} ${record.id} opened. Resume after reviewing, or explicitly continue without waiting.` }));
}

export async function runCompletionHook(agent: ReviewOrigin["agent"], loupeRoot: string): Promise<void> {
  try { await performCompletionHook(agent, loupeRoot); }
  catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.log(JSON.stringify({ systemMessage: `${PRODUCT.displayName} was not opened: ${message}` }));
  }
}
